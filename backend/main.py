from fastapi import FastAPI, Query, Request # type: ignore
from google import genai  # type: ignore
import yfinance as yf # type: ignore
import pandas as pd
import pandas_ta as ta
from fastapi.middleware.cors import CORSMiddleware # type: ignore
import os
import json
import math
from datetime import UTC, datetime, timedelta
from typing import Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Retrieve Gemini API Key
API_KEY = os.getenv("GEMINI_API_KEY")

# Validate API Key
if not API_KEY:
    raise ValueError("GEMINI_API_KEY is missing. Please set it in your .env file.")

# Initialize FastAPI app
app = FastAPI()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Adjust if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini AI
client = genai.Client(api_key=API_KEY)

# In-memory cache
analysis_cache: dict[str, dict[str, Any]] = {}
CACHE_TTL_SECONDS = {
    "1d": 5 * 60,
    "1w": 15 * 60,
    "1m": 60 * 60,
    "6m": 60 * 60,
    "1y": 6 * 60 * 60,
}


def get_last_indicator_value(df: pd.DataFrame, preferred_keys: list[str], fallback_prefixes: list[str]) -> float:
    if df is None or df.empty:
        raise ValueError("Indicator dataframe is empty")

    for key in preferred_keys:
        if key in df.columns:
            return float(df[key].iloc[-1])

    for prefix in fallback_prefixes:
        for column in df.columns:
            if column.startswith(prefix):
                return float(df[column].iloc[-1])

    raise ValueError(f"Required indicator column not found. Available columns: {list(df.columns)}")


def to_nullable(value):
    if pd.isna(value):
        return None
    return value.item() if hasattr(value, "item") else value


def to_float(value) -> float | None:
    if value is None:
        return None
    try:
        numeric_value = float(value)
        if not math.isfinite(numeric_value):
            return None
        return numeric_value
    except (TypeError, ValueError):
        return None


def get_last_series_value(series: pd.Series | None) -> float | None:
    if series is None or len(series) == 0:
        return None

    return to_float(series.iloc[-1])


def safe_bool(value) -> bool:
    return bool(value)


def safe_ratio(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator is None:
        return None
    if denominator == 0:
        return None
    ratio = numerator / denominator
    if not math.isfinite(ratio):
        return None
    return ratio


def get_statement_metric(statement_df: pd.DataFrame, labels: list[str]) -> float | None:
    if statement_df is None or statement_df.empty:
        return None

    available_index = {str(idx).strip().lower(): idx for idx in statement_df.index}
    target_index = None

    for label in labels:
        normalized_label = label.strip().lower()
        if normalized_label in available_index:
            target_index = available_index[normalized_label]
            break

    if target_index is None:
        return None

    row = statement_df.loc[target_index]
    if isinstance(row, pd.Series):
        for value in row.values:
            candidate = to_float(value)
            if candidate is not None:
                return candidate

    return None


def get_fast_info_value(ticker: yf.Ticker, key: str) -> float | None:
    try:
        fast_info = ticker.fast_info
        raw_value = fast_info.get(key) if hasattr(fast_info, "get") else None
        return to_float(raw_value)
    except Exception:
        return None


def build_fundamentals(ticker: yf.Ticker) -> dict[str, float | None]:
    income_stmt = ticker.income_stmt
    balance_sheet = ticker.balance_sheet
    cashflow = ticker.cashflow

    revenue = get_statement_metric(income_stmt, ["Total Revenue", "Revenue"])
    net_income = get_statement_metric(income_stmt, ["Net Income", "Net Income Common Stockholders"])
    total_assets = get_statement_metric(balance_sheet, ["Total Assets"])
    total_liabilities = get_statement_metric(balance_sheet, ["Total Liabilities Net Minority Interest", "Total Liabilities"])
    free_cash_flow = get_statement_metric(cashflow, ["Free Cash Flow"])

    profit_margin = safe_ratio(net_income, revenue)
    debt_ratio = safe_ratio(total_liabilities, total_assets)
    free_cash_flow_margin = safe_ratio(free_cash_flow, revenue)

    pe_ratio = None
    pb_ratio = None
    market_cap = get_fast_info_value(ticker, "marketCap")

    # Fallback to ticker.info only if statement-based/fast_info values are unavailable
    if any(value is None for value in [revenue, net_income, total_assets, total_liabilities, free_cash_flow, profit_margin, debt_ratio, free_cash_flow_margin, market_cap]):
        info = ticker.info
        revenue = revenue if revenue is not None else to_float(info.get("totalRevenue"))
        net_income = net_income if net_income is not None else to_float(info.get("netIncomeToCommon"))
        total_assets = total_assets if total_assets is not None else to_float(info.get("totalAssets"))
        total_liabilities = total_liabilities if total_liabilities is not None else to_float(info.get("totalDebt"))
        free_cash_flow = free_cash_flow if free_cash_flow is not None else to_float(info.get("freeCashflow"))

        if profit_margin is None:
            profit_margin = safe_ratio(net_income, revenue)
            if profit_margin is None:
                profit_margin = to_float(info.get("profitMargins"))

        if debt_ratio is None:
            debt_ratio = safe_ratio(total_liabilities, total_assets)

        if free_cash_flow_margin is None:
            free_cash_flow_margin = safe_ratio(free_cash_flow, revenue)

        if market_cap is None:
            market_cap = to_float(info.get("marketCap"))

        pe_ratio = to_float(info.get("trailingPE"))
        pb_ratio = to_float(info.get("priceToBook"))
    else:
        # Still collect valuation metrics if available from fallback source
        info = ticker.info
        pe_ratio = to_float(info.get("trailingPE"))
        pb_ratio = to_float(info.get("priceToBook"))

    return {
        "revenue": revenue,
        "net_income": net_income,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "free_cash_flow": free_cash_flow,
        "profit_margin": profit_margin,
        "debt_ratio": debt_ratio,
        "free_cash_flow_margin": free_cash_flow_margin,
        "market_cap": market_cap,
        "pe_ratio": pe_ratio,
        "pb_ratio": pb_ratio,
    }


def get_cache_key(ticker: str, range_key: str) -> str:
    return f"{ticker}_{range_key}"


def get_cached_value(cache_key: str):
    cached_entry = analysis_cache.get(cache_key)
    if not cached_entry:
        return None

    if datetime.now(UTC) >= cached_entry["expires_at"]:
        del analysis_cache[cache_key]
        return None

    return cached_entry["data"]


def set_cached_value(cache_key: str, range_key: str, value):
    ttl_seconds = CACHE_TTL_SECONDS.get(range_key, CACHE_TTL_SECONDS["1y"])
    analysis_cache[cache_key] = {
        "expires_at": datetime.now(UTC) + timedelta(seconds=ttl_seconds),
        "data": value,
    }


def build_chart_data(history: pd.DataFrame) -> list[dict]:
    if history.empty:
        return []

    chart_df = history.copy()
    chart_df = chart_df.reset_index()

    time_column = "Datetime" if "Datetime" in chart_df.columns else "Date"
    chart_df["chart_time"] = pd.to_datetime(chart_df[time_column]).dt.strftime("%Y-%m-%d")

    grouped = (
        chart_df.groupby("chart_time", as_index=False)
        .agg(
            open=("Open", "first"),
            high=("High", "max"),
            low=("Low", "min"),
            close=("Close", "last"),
        )
    )

    results = []
    for _, row in grouped.iterrows():
        open_price = to_float(row["open"])
        high_price = to_float(row["high"])
        low_price = to_float(row["low"])
        close_price = to_float(row["close"])

        if None in (open_price, high_price, low_price, close_price):
            continue

        results.append(
            {
                "time": row["chart_time"],
                "open": open_price,
                "high": high_price,
                "low": low_price,
                "close": close_price,
            }
        )

    return results


@app.get("/api/stock/{ticker_symbol}")
async def get_stock_analysis(request: Request, ticker_symbol: str, range: str = Query(default="1y")):
    try:
        normalized_symbol = ticker_symbol.strip().upper()
        range_key = range.lower()

        range_map = {
            "1d": {"period": "1d", "interval": "5m"},
            "1w": {"period": "5d", "interval": "15m"},
            "1m": {"period": "1mo", "interval": "1d"},
            "6m": {"period": "6mo", "interval": "1d"},
            "1y": {"period": "1y", "interval": "1d"},
        }
        selected_range = range_map.get(range_key, range_map["1y"])

        # Fetch stock data with fallbacks for Indian exchanges
        ticker_candidates = [normalized_symbol]
        if "." not in normalized_symbol:
            ticker_candidates.extend([f"{normalized_symbol}.NS", f"{normalized_symbol}.BO"])

        ticker = None
        history = pd.DataFrame()
        resolved_symbol = normalized_symbol

        for candidate in ticker_candidates:
            candidate_ticker = yf.Ticker(candidate)
            candidate_history = candidate_ticker.history(period="1y")
            if not candidate_history.empty:
                ticker = candidate_ticker
                history = candidate_history
                resolved_symbol = candidate
                break

        # Ensure data is available
        if history.empty:
            return {
                "error": f"No stock data found for {normalized_symbol}. Try symbol with exchange suffix like .NS or .BO.",
                "chartData": [],
            }

        chart_history = ticker.history(period=selected_range["period"], interval=selected_range["interval"])
        chart_data = build_chart_data(chart_history)

        # Fast chart-only response for timeframe chart requests
        if "range" in request.query_params:
            return {"chartData": chart_data}

        cache_key = get_cache_key(normalized_symbol, range_key)
        cached_analysis = get_cached_value(cache_key)
        if cached_analysis:
            return cached_analysis

        fast_last_price = get_fast_info_value(ticker, "lastPrice")
        latest_price = fast_last_price if fast_last_price is not None else to_float(history["Close"].iloc[-1])
        if latest_price is None:
            return {"error": f"Unable to determine latest price for {resolved_symbol}."}

        # Calculate Technical Indicators
        sma_50 = get_last_series_value(ta.sma(history["Close"], length=50))
        sma_200 = get_last_series_value(ta.sma(history["Close"], length=200))
        ema_20 = get_last_series_value(ta.ema(history["Close"], length=20))
        rsi = get_last_series_value(ta.rsi(history["Close"], length=14))
        macd = ta.macd(history["Close"])
        bbands = ta.bbands(history["Close"], length=20)
        atr = get_last_series_value(ta.atr(history["High"], history["Low"], history["Close"], length=14))
        stoch = ta.stoch(history["High"], history["Low"], history["Close"], k=14, d=3)
        obv_series = ta.obv(history["Close"], history["Volume"])
        obv = get_last_series_value(obv_series)

        volume_ma_20 = to_float(history["Volume"].rolling(window=20).mean().iloc[-1])
        latest_volume = to_float(history["Volume"].iloc[-1])
        volume_above_avg = safe_bool(
            latest_volume is not None and volume_ma_20 is not None and latest_volume > volume_ma_20
        )

        bullish_trend = safe_bool(sma_50 is not None and sma_200 is not None and sma_50 > sma_200)

        # Multi-timeframe validation
        higher_tf_history = ticker.history(period="6mo", interval="1d")
        higher_tf_sma_50 = get_last_series_value(ta.sma(higher_tf_history["Close"], length=50)) if not higher_tf_history.empty else None
        higher_tf_sma_200 = get_last_series_value(ta.sma(higher_tf_history["Close"], length=200)) if not higher_tf_history.empty else None
        short_term_bullish = safe_bool(sma_50 is not None and latest_price > sma_50)
        long_term_bullish = safe_bool(
            higher_tf_sma_50 is not None and higher_tf_sma_200 is not None and higher_tf_sma_50 > higher_tf_sma_200
        )
        trend_alignment = safe_bool(short_term_bullish == long_term_bullish)

        # Extract MACD values
        try:
            macd_value = to_float(get_last_indicator_value(macd, ["MACD_12_26_9"], ["MACD_"]))
            macd_signal = to_float(get_last_indicator_value(macd, ["MACDs_12_26_9"], ["MACDs_"]))
        except ValueError:
            macd_value = None
            macd_signal = None

        # Extract Bollinger Bands values
        try:
            bb_upper = to_float(get_last_indicator_value(bbands, ["BBU_20_2.0", "BBU_20_2"], ["BBU_"]))
            bb_lower = to_float(get_last_indicator_value(bbands, ["BBL_20_2.0", "BBL_20_2"], ["BBL_"]))
        except ValueError:
            bb_upper = None
            bb_lower = None

        # Extract Stochastic Oscillator values
        try:
            stoch_k = to_float(get_last_indicator_value(stoch, ["STOCHk_14_3_3"], ["STOCHk_"]))
            stoch_d = to_float(get_last_indicator_value(stoch, ["STOCHd_14_3_3"], ["STOCHd_"]))
        except ValueError:
            stoch_k = None
            stoch_d = None

        fundamentals = build_fundamentals(ticker)
        pe_ratio = to_float(fundamentals["pe_ratio"])
        profit_margin = to_float(fundamentals["profit_margin"])
        obv_increasing = safe_bool(
            obv_series is not None
            and len(obv_series) > 1
            and to_float(obv_series.iloc[-1]) is not None
            and to_float(obv_series.iloc[-2]) is not None
            and to_float(obv_series.iloc[-1]) > to_float(obv_series.iloc[-2])
        )

        # Safe scoring inputs (keep logic unchanged)
        atr_for_scoring = atr if atr is not None else 0.0
        rsi_for_scoring = rsi if rsi is not None else 50.0
        sma_50_for_scoring = sma_50 if sma_50 is not None else 0.0
        macd_value_for_scoring = macd_value if macd_value is not None else 0.0
        macd_signal_for_scoring = macd_signal if macd_signal is not None else 0.0

        # Deterministic risk score (0-100)
        risk_score = 0
        if atr_for_scoring > latest_price * 0.03:
            risk_score += 25
        if rsi_for_scoring < 30 or rsi_for_scoring > 70:
            risk_score += 20
        if latest_price < sma_50_for_scoring:
            risk_score += 20
        if macd_value_for_scoring < macd_signal_for_scoring:
            risk_score += 20
        if pe_ratio is not None and pe_ratio > 30:
            risk_score += 15
        risk_score = min(risk_score, 100)

        if risk_score < 40:
            risk_level = "Low"
        elif risk_score <= 70:
            risk_level = "Moderate"
        else:
            risk_level = "High"

        # Deterministic confidence score (0-100)
        confidence_score = 0
        if latest_price > sma_50_for_scoring:
            confidence_score += 25
        if rsi_for_scoring > 50:
            confidence_score += 20
        if macd_value_for_scoring > macd_signal_for_scoring:
            confidence_score += 20
        if obv_increasing:
            confidence_score += 15
        if profit_margin is not None and profit_margin > 0.10:
            confidence_score += 20
        confidence_score = min(confidence_score, 100)

        # Deterministic buy/sell weighted probabilities
        bullish_score = 0
        bearish_score = 0

        if latest_price > sma_50_for_scoring:
            bullish_score += 2
        else:
            bearish_score += 2

        if rsi_for_scoring > 50:
            bullish_score += 1
        else:
            bearish_score += 1

        if macd_value_for_scoring > macd_signal_for_scoring:
            bullish_score += 2
        else:
            bearish_score += 2

        if (stoch_k if stoch_k is not None else 0.0) > (stoch_d if stoch_d is not None else 0.0):
            bullish_score += 1
        else:
            bearish_score += 1

        total_weight = bullish_score + bearish_score
        buy_probability = round((bullish_score / total_weight) * 100) if total_weight > 0 else 50
        sell_probability = 100 - buy_probability

        indicators = {
            "price": {
                "current": to_nullable(latest_price),
                "sma_50": to_nullable(sma_50),
                "sma_200": to_nullable(sma_200),
                "ema_20": to_nullable(ema_20),
                "bullish_trend": bullish_trend,
                "trend_alignment": trend_alignment,
            },
            "momentum": {
                "rsi": to_nullable(rsi),
                "macd": {
                    "value": to_nullable(macd_value),
                    "signal": to_nullable(macd_signal),
                },
                "stochastic": {
                    "k": to_nullable(stoch_k),
                    "d": to_nullable(stoch_d),
                },
            },
            "volatility": {
                "atr": to_nullable(atr),
                "bollinger": {
                    "upper": to_nullable(bb_upper),
                    "lower": to_nullable(bb_lower),
                },
            },
            "volume": {
                "obv": to_nullable(obv),
                "volume_ma_20": to_nullable(volume_ma_20),
                "volume_above_avg": volume_above_avg,
                "obv_increasing": obv_increasing,
            },
            "fundamentals": {
                "revenue": to_nullable(fundamentals["revenue"]),
                "net_income": to_nullable(fundamentals["net_income"]),
                "profit_margin": to_nullable(fundamentals["profit_margin"]),
                "debt_ratio": to_nullable(fundamentals["debt_ratio"]),
                "free_cash_flow_margin": to_nullable(fundamentals["free_cash_flow_margin"]),
                "market_cap": to_nullable(fundamentals["market_cap"]),
                "pe_ratio": to_nullable(fundamentals["pe_ratio"]),
                "pb_ratio": to_nullable(fundamentals["pb_ratio"]),
            },
        }

        scores = {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "confidence_score": confidence_score,
            "buy_probability": buy_probability,
            "sell_probability": sell_probability,
        }

        # Gemini explanation-only prompt (no numeric generation)
        gemini_payload = {
            "indicators": indicators,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "confidence_score": confidence_score,
            "buy_probability": buy_probability,
            "sell_probability": sell_probability,
        }

        stock_data_prompt = (
            "You are a senior financial analyst writing a clear, investor-friendly stock summary.\n\n"
            "Explain the stock using the provided indicators and computed scores.\n\n"
            "Rules:\n"
            "- Use simple, clear language.\n"
            "- Avoid excessive technical jargon.\n"
            "- Do not restate raw numbers unnecessarily.\n"
            "- Focus on what the indicators imply.\n"
            "- Explain contradictions (e.g., low risk but bearish probability).\n"
            "- Keep tone professional and neutral.\n"
            "- Do not generate new numbers.\n"
            "- Base conclusions strictly on provided data.\n"
            "- Make it structured but concise.\n"
            "- End with a short 3–4 sentence executive summary.\n"
            "- Keep total length under 500 words.\n\n"
            "Use this exact structure:\n"
            "1. Executive Summary\n"
            "2. Trend Position\n"
            "3. Momentum Signals\n"
            "4. Volatility & Risk Context\n"
            "5. Fundamentals Snapshot\n"
            "6. Final Interpretation\n\n"
            "Input data:\n"
            f"{json.dumps(gemini_payload, indent=2)}"
        )

        response = None
        model_candidates = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-1.5-flash"]
        last_error = None

        for model_name in model_candidates:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=stock_data_prompt,
                    config={"temperature": 0},
                )
                if response and response.text:
                    break
            except Exception as model_error:
                last_error = model_error
                continue

        # Ensure AI generated a valid response; fallback remains deterministic
        if not response or not response.text:
            directional_bias = "Bullish" if buy_probability > sell_probability else "Bearish" if sell_probability > buy_probability else "Neutral"

            contradiction_note = ""
            if risk_level == "Low" and sell_probability > buy_probability:
                contradiction_note = (
                    "Although overall risk is low, current technical signals lean bearish, which can pressure short-term performance."
                )
            elif risk_level == "High" and buy_probability > sell_probability:
                contradiction_note = (
                    "Even with a bullish tilt in signals, the elevated risk level suggests outcomes may be less stable."
                )

            trend_position_text = (
                "The stock is above key moving averages, which supports an upward trend."
                if latest_price > (sma_50 if sma_50 is not None else latest_price)
                else "The stock is below key moving averages, which points to a weaker trend."
            )

            momentum_text = (
                "Momentum is improving, with directional indicators favoring buyers."
                if (macd_value if macd_value is not None else 0.0) > (macd_signal if macd_signal is not None else 0.0)
                else "Momentum is soft, and short-term buying strength appears weak."
            )

            volatility_text = (
                "Volatility looks contained relative to price action, supporting a more stable near-term profile."
                if risk_level == "Low"
                else "Volatility signals are elevated, so price swings may be wider than usual."
            )

            fundamentals_text = (
                "Profitability and cash generation indicate improving business quality."
                if (profit_margin if profit_margin is not None else 0.0) > 0.10
                else "Fundamentals are mixed, with profitability or cash efficiency not yet strong."
            )

            fallback_report = f"""
1. Executive Summary
{resolved_symbol} currently has a {directional_bias.lower()} bias with {buy_probability}% buy probability and {sell_probability}% sell probability. The model confidence score is {confidence_score}/100, while risk is rated {risk_level.lower()} at {risk_score}/100. This combination suggests a {"balanced" if directional_bias == "Neutral" else "directional"} setup rather than a one-sided signal.

2. Trend Position
{trend_position_text}

3. Momentum Signals
{momentum_text}

4. Volatility & Risk Context
{volatility_text}
{contradiction_note}

5. Fundamentals Snapshot
{fundamentals_text}

6. Final Interpretation
Overall bias: {directional_bias}. Confidence at {confidence_score}/100 means signal alignment is {"strong" if confidence_score >= 70 else "moderate" if confidence_score >= 40 else "weak"}. The {buy_probability}/{sell_probability} split suggests {"buyers currently have an edge" if buy_probability > sell_probability else "sellers currently have an edge" if sell_probability > buy_probability else "a balanced setup"}. Position sizing should reflect the {risk_level.lower()} risk profile.
"""

            result_payload = {
                "scores": scores,
                "indicators": indicators,
                "analysis_text": fallback_report.strip(),
            }
            set_cached_value(cache_key, range_key, result_payload)
            return result_payload

        result_payload = {
            "scores": scores,
            "indicators": indicators,
            "analysis_text": response.text,
        }
        set_cached_value(cache_key, range_key, result_payload)
        return result_payload

    except Exception as e:
        return {"error": str(e)}

# Run the FastAPI server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)