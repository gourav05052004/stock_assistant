from fastapi import FastAPI # type: ignore
from google import genai  # type: ignore
import yfinance as yf # type: ignore
import pandas as pd
import pandas_ta as ta
from fastapi.middleware.cors import CORSMiddleware # type: ignore
import os
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


def get_last_indicator_value(df: pd.DataFrame, preferred_keys: list[str], fallback_prefixes: list[str]) -> float:
    for key in preferred_keys:
        if key in df.columns:
            return float(df[key].iloc[-1])

    for prefix in fallback_prefixes:
        for column in df.columns:
            if column.startswith(prefix):
                return float(df[column].iloc[-1])

    raise ValueError(f"Required indicator column not found. Available columns: {list(df.columns)}")


@app.get("/api/stock/{ticker_symbol}")
async def get_stock_analysis(ticker_symbol: str):
    try:
        normalized_symbol = ticker_symbol.strip().upper()

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
            return {"error": f"No stock data found for {normalized_symbol}. Try symbol with exchange suffix like .NS or .BO."}

        latest_price = history["Close"].iloc[-1]

        # Calculate Technical Indicators
        sma_50 = ta.sma(history["Close"], length=50).iloc[-1]
        ema_20 = ta.ema(history["Close"], length=20).iloc[-1]
        rsi = ta.rsi(history["Close"], length=14).iloc[-1]
        macd = ta.macd(history["Close"])
        bbands = ta.bbands(history["Close"], length=20)
        atr = ta.atr(history["High"], history["Low"], history["Close"], length=14).iloc[-1]
        stoch = ta.stoch(history["High"], history["Low"], history["Close"], k=14, d=3)
        obv = ta.obv(history["Close"], history["Volume"]).iloc[-1]

        # Extract MACD values
        macd_value = get_last_indicator_value(macd, ["MACD_12_26_9"], ["MACD_"])
        macd_signal = get_last_indicator_value(macd, ["MACDs_12_26_9"], ["MACDs_"])

        # Extract Bollinger Bands values
        bb_upper = get_last_indicator_value(bbands, ["BBU_20_2.0", "BBU_20_2"], ["BBU_"])
        bb_lower = get_last_indicator_value(bbands, ["BBL_20_2.0", "BBL_20_2"], ["BBL_"])

        # Extract Stochastic Oscillator values
        stoch_k = get_last_indicator_value(stoch, ["STOCHk_14_3_3"], ["STOCHk_"])
        stoch_d = get_last_indicator_value(stoch, ["STOCHd_14_3_3"], ["STOCHd_"])

        # Fetch fundamental data
        info = ticker.info
        fundamentals = {
            "Revenue": info.get("totalRevenue", "N/A"),
            "Market Cap": info.get("marketCap", "N/A"),
            "Profit Margin": info.get("profitMargins", "N/A"),
            "P/E Ratio": info.get("trailingPE", "N/A"),
            "P/B Ratio": info.get("priceToBook", "N/A"),
        }

        # Generate stock analysis report
        stock_data_prompt = f"""
        Generate a detailed and structured stock analysis report for {resolved_symbol}.
        Consider the following indicators:
        - Latest Price: {latest_price}
        - Moving Averages: SMA_50 ({sma_50}), EMA_20 ({ema_20})
        - RSI: {rsi}
        - MACD: Value ({macd_value}), Signal ({macd_signal})
        - Bollinger Bands: Upper ({bb_upper}), Lower ({bb_lower})
        - ATR: {atr}
        - Stochastic Oscillator: K ({stoch_k}), D ({stoch_d})
        - OBV: {obv}
        - Fundamental Data: {fundamentals}
        Provide an expert analysis based on these indicators.
        Do not include any specific dates in the report.
        """

        response = None
        model_candidates = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-1.5-flash"]
        last_error = None

        for model_name in model_candidates:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=stock_data_prompt,
                )
                if response and response.text:
                    break
            except Exception as model_error:
                last_error = model_error
                continue

        # Ensure AI generated a valid response; if unavailable, provide local fallback analysis
        if not response or not response.text:
            trend_view = "Bullish" if latest_price > sma_50 and latest_price > ema_20 else "Bearish/Neutral"
            rsi_view = "Overbought" if rsi > 70 else "Oversold" if rsi < 30 else "Neutral"
            macd_view = "Bullish momentum" if macd_value > macd_signal else "Bearish momentum"

            fallback_report = f"""
## Stock Analysis for {resolved_symbol}

### Price & Trend
- Latest Price: {latest_price:.2f}
- SMA 50: {sma_50:.2f}
- EMA 20: {ema_20:.2f}
- Trend Signal: {trend_view}

### Momentum
- RSI (14): {rsi:.2f} ({rsi_view})
- MACD: {macd_value:.4f}
- MACD Signal: {macd_signal:.4f}
- Momentum Signal: {macd_view}

### Volatility & Bands
- Bollinger Upper: {bb_upper:.2f}
- Bollinger Lower: {bb_lower:.2f}
- ATR (14): {atr:.2f}

### Volume & Oscillator
- Stochastic K: {stoch_k:.2f}
- Stochastic D: {stoch_d:.2f}
- OBV: {obv:.2f}

### Fundamentals Snapshot
- Revenue: {fundamentals['Revenue']}
- Market Cap: {fundamentals['Market Cap']}
- Profit Margin: {fundamentals['Profit Margin']}
- P/E Ratio: {fundamentals['P/E Ratio']}
- P/B Ratio: {fundamentals['P/B Ratio']}

_Note: AI service was temporarily unavailable, so this report was generated from quantitative indicators._
"""
            return {"stock_analysis": fallback_report}

        return {"stock_analysis": response.text}

    except Exception as e:
        return {"error": str(e)}

# Run the FastAPI server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)