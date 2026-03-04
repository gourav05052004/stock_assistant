from fastapi import FastAPI, Query, Request # type: ignore
from google import genai  # type: ignore
import yfinance as yf # type: ignore
import pandas as pd
import pandas_ta as ta
import httpx
import logging
from fastapi.middleware.cors import CORSMiddleware # type: ignore
import os
import json
import math
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Retrieve Gemini API Key
API_KEY = os.getenv("GEMINI_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# Validate API Key
if not API_KEY:
    raise ValueError("GEMINI_API_KEY is missing. Please set it in your .env file.")

if not NEWS_API_KEY:
    raise ValueError("NEWS_API_KEY is missing in .env file.")

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
logger = logging.getLogger(__name__)

# In-memory cache
analysis_cache: dict[str, dict[str, Any]] = {}
CACHE_TTL_SECONDS = {
    "1d": 5 * 60,
    "1w": 5 * 60,
    "1m": 5 * 60,
    "6m": 5 * 60,
    "1y": 5 * 60,
}

REQUIRED_SECTION_TITLES = [
    "Executive Summary",
    "Trend Position",
    "Momentum Signals",
    "Volatility & Risk Context",
    "Fundamentals Snapshot",
    "Bullish Case vs Bearish Case",
    "Final Interpretation",
]

SECTION_KEY_MAP = {
    "Executive Summary": "executive_summary",
    "Trend Position": "trend_position",
    "Momentum Signals": "momentum_signals",
    "Volatility & Risk Context": "volatility_risk_context",
    "Fundamentals Snapshot": "fundamentals_snapshot",
    "Bullish Case vs Bearish Case": "bullish_vs_bearish_case",
    "Final Interpretation": "final_interpretation",
}


def normalize_section_title(raw_title: str) -> str | None:
    normalized = raw_title.strip().lower()
    normalized = re.sub(r"[*_`]+", "", normalized)
    normalized = re.sub(r"^\d+\.\s*", "", normalized)
    normalized = re.sub(r"^\d+\)\s*", "", normalized)
    normalized = re.sub(r"^#+\s*", "", normalized)
    normalized = re.sub(r"[:\-–—]+$", "", normalized).strip()
    normalized = normalized.replace(" and ", " & ")
    normalized = re.sub(r"\s+", " ", normalized)

    for canonical in REQUIRED_SECTION_TITLES:
        canonical_lower = canonical.lower().replace(" and ", " & ")
        if normalized == canonical_lower or canonical_lower in normalized:
            return canonical

    return None


def extract_section_heading(line: str) -> str | None:
    stripped = line.strip()
    if not stripped:
        return None

    cleaned = re.sub(r"^[-*]\s+", "", stripped)
    cleaned = re.sub(r"^\*\*(.*?)\*\*$", r"\1", cleaned)
    cleaned = re.sub(r"^__([^_]+)__$", r"\1", cleaned)
    cleaned = cleaned.strip(" *_`")
    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned)
    cleaned = re.sub(r"^\d+[\.)]\s*", "", cleaned)
    cleaned = cleaned.strip(" *_`:;-–—")

    return normalize_section_title(cleaned)


def normalize_analysis_text(raw_text: str) -> str:
    if not raw_text:
        raw_text = ""

    lines = raw_text.replace("\r", "").split("\n")
    sections: dict[str, list[str]] = {title: [] for title in REQUIRED_SECTION_TITLES}
    current_section: str | None = None

    for line in lines:
        canonical = extract_section_heading(line)
        if canonical:
            current_section = canonical
            continue

        if current_section:
            sections[current_section].append(line)

    if all(len("\n".join(content).strip()) == 0 for content in sections.values()):
        sections["Executive Summary"] = [raw_text.strip()] if raw_text.strip() else ["Not enough signal clarity to provide this section."]

    output_parts: list[str] = []
    for idx, title in enumerate(REQUIRED_SECTION_TITLES, start=1):
        content = "\n".join(sections[title]).strip()
        if not content:
            content = "Not enough signal clarity to provide this section."
        output_parts.append(f"{idx}. {title}\n{content}")

    return "\n\n".join(output_parts)


def build_analysis_sections(normalized_text: str) -> list[dict[str, str]]:
    sections: list[dict[str, str]] = []
    lines = normalized_text.replace("\r", "").split("\n")
    current_title: str | None = None
    buffer: list[str] = []

    def push_section():
        nonlocal buffer, current_title
        if not current_title:
            return

        key = SECTION_KEY_MAP.get(current_title, re.sub(r"[^a-z0-9]+", "_", current_title.lower()).strip("_"))
        content = "\n".join(buffer).strip()
        sections.append(
            {
                "key": key,
                "title": current_title,
                "content": content,
            }
        )
        buffer = []

    for line in lines:
        heading_match = re.match(r"^\s*\d+\.\s+(.+?)\s*$", line.strip())
        if heading_match:
            push_section()
            title_candidate = heading_match.group(1).strip()
            current_title = normalize_section_title(title_candidate) or title_candidate
            continue

        if current_title:
            buffer.append(line)

    push_section()

    if not sections:
        return [
            {
                "key": "executive_summary",
                "title": "Executive Summary",
                "content": normalized_text.strip() or "Not enough signal clarity to provide this section.",
            }
        ]

    return sections


def format_metric(value: Any, decimals: int = 2) -> str:
    numeric_value = to_float(value)
    if numeric_value is None:
        return "N/A"
    return f"{numeric_value:.{decimals}f}"


def format_compact_number(value: Any, decimals: int = 2) -> str:
    numeric_value = to_float(value)
    if numeric_value is None:
        return "N/A"

    sign = "-" if numeric_value < 0 else ""
    absolute_value = abs(numeric_value)

    thresholds = [
        (1_000_000_000_000, "T"),
        (1_000_000_000, "B"),
        (1_000_000, "M"),
        (1_000, "K"),
    ]

    for threshold, suffix in thresholds:
        if absolute_value >= threshold:
            compact_value = absolute_value / threshold
            return f"{sign}{compact_value:.{decimals}f}{suffix}"

    return f"{numeric_value:.{decimals}f}"


def format_currency(value: Any, decimals: int = 2) -> str:
    numeric_value = to_float(value)
    if numeric_value is None:
        return "N/A"
    return f"Rs. {numeric_value:.{decimals}f}"


def format_currency_compact(value: Any, decimals: int = 2) -> str:
    compact_value = format_compact_number(value, decimals)
    if compact_value == "N/A":
        return compact_value
    if compact_value.startswith("-"):
        return f"-Rs. {compact_value[1:]}"
    return f"Rs. {compact_value}"


def format_percent(value: Any, decimals: int = 2) -> str:
    numeric_value = to_float(value)
    if numeric_value is None:
        return "N/A"
    return f"{numeric_value * 100:.{decimals}f}%"


def bool_label(value: Any) -> str:
    if value is True:
        return "Yes"
    if value is False:
        return "No"
    return "N/A"


def build_section_data_points(symbol: str, indicators: dict[str, Any], scores: dict[str, Any]) -> dict[str, list[str]]:
    price = indicators.get("price", {}) if isinstance(indicators, dict) else {}
    momentum = indicators.get("momentum", {}) if isinstance(indicators, dict) else {}
    volatility = indicators.get("volatility", {}) if isinstance(indicators, dict) else {}
    volume = indicators.get("volume", {}) if isinstance(indicators, dict) else {}
    fundamentals = indicators.get("fundamentals", {}) if isinstance(indicators, dict) else {}

    macd = momentum.get("macd", {}) if isinstance(momentum, dict) else {}
    stochastic = momentum.get("stochastic", {}) if isinstance(momentum, dict) else {}
    bollinger = volatility.get("bollinger", {}) if isinstance(volatility, dict) else {}

    buy_probability = scores.get("buy_probability")
    sell_probability = scores.get("sell_probability")
    confidence_score = scores.get("confidence_score")
    risk_score = scores.get("risk_score")
    risk_level = scores.get("risk_level", "N/A")

    return {
        "Executive Summary": [
            f"Symbol: {symbol}",
            f"Current Price: {format_currency(price.get('current'))}",
            f"Buy/Sell Probability: {format_metric(buy_probability, 0)}% / {format_metric(sell_probability, 0)}%",
            f"Confidence Score: {format_metric(confidence_score, 0)}/100",
            f"Risk Score: {format_metric(risk_score, 0)}/100 ({risk_level})",
        ],
        "Trend Position": [
            f"Price vs SMA50: {format_currency(price.get('current'))} vs {format_currency(price.get('sma_50'))}",
            f"Price vs SMA200: {format_currency(price.get('current'))} vs {format_currency(price.get('sma_200'))}",
            f"EMA20: {format_currency(price.get('ema_20'))}",
            f"Bullish Trend: {bool_label(price.get('bullish_trend'))}",
            f"Trend Alignment: {bool_label(price.get('trend_alignment'))}",
        ],
        "Momentum Signals": [
            f"RSI(14): {format_metric(momentum.get('rsi'))}",
            f"MACD Value/Signal: {format_metric(macd.get('value'))} / {format_metric(macd.get('signal'))}",
            f"Stochastic K/D: {format_metric(stochastic.get('k'))} / {format_metric(stochastic.get('d'))}",
            f"Buy/Sell Probability: {format_metric(buy_probability, 0)}% / {format_metric(sell_probability, 0)}%",
        ],
        "Volatility & Risk Context": [
            f"ATR(14): {format_currency(volatility.get('atr'))}",
            f"Bollinger Upper/Lower: {format_currency(bollinger.get('upper'))} / {format_currency(bollinger.get('lower'))}",
            f"Volume Above 20D Avg: {bool_label(volume.get('volume_above_avg'))}",
            f"OBV: {format_compact_number(volume.get('obv'))}",
            f"OBV Increasing: {bool_label(volume.get('obv_increasing'))}",
            f"Risk Score: {format_metric(risk_score, 0)}/100 ({risk_level})",
        ],
        "Fundamentals Snapshot": [
            f"Revenue: {format_currency_compact(fundamentals.get('revenue'))}",
            f"Net Income: {format_currency_compact(fundamentals.get('net_income'))}",
            f"Profit Margin: {format_percent(fundamentals.get('profit_margin'))}",
            f"Debt Ratio: {format_percent(fundamentals.get('debt_ratio'))}",
            f"Free Cash Flow Margin: {format_percent(fundamentals.get('free_cash_flow_margin'))}",
            f"Market Cap: {format_currency_compact(fundamentals.get('market_cap'))}",
            f"P/E and P/B: {format_metric(fundamentals.get('pe_ratio'))} / {format_metric(fundamentals.get('pb_ratio'))}",
        ],
        "Bullish Case vs Bearish Case": [
            f"Buy Probability: {format_metric(buy_probability, 0)}%",
            f"Sell Probability: {format_metric(sell_probability, 0)}%",
            f"Trend Alignment: {bool_label(price.get('trend_alignment'))}",
            f"Momentum (MACD > Signal): {bool_label(to_float(macd.get('value')) is not None and to_float(macd.get('signal')) is not None and to_float(macd.get('value')) > to_float(macd.get('signal')))}",
            f"Volatility Context (ATR): {format_currency(volatility.get('atr'))}",
        ],
        "Final Interpretation": [
            f"Risk Level: {risk_level}",
            f"Risk/Confidence: {format_metric(risk_score, 0)} / {format_metric(confidence_score, 0)}",
            f"Directional Split: {format_metric(buy_probability, 0)}% Buy vs {format_metric(sell_probability, 0)}% Sell",
            f"Current Price: {format_currency(price.get('current'))}",
        ],
    }


def enrich_analysis_sections_with_data(sections: list[dict[str, str]], symbol: str, indicators: dict[str, Any], scores: dict[str, Any]) -> list[dict[str, str]]:
    data_map = build_section_data_points(symbol, indicators, scores)
    enriched_sections: list[dict[str, str]] = []

    for section in sections:
        title = section.get("title", "")
        content = section.get("content", "").strip()
        points = data_map.get(title, [])

        data_block = ""
        if points:
            data_block = "**Data Points**\n" + "\n".join(f"- {point}" for point in points)

        combined_content = f"{data_block}\n\n{content}".strip() if content else data_block
        enriched_sections.append(
            {
                "key": section.get("key", ""),
                "title": title,
                "content": combined_content.strip() if combined_content else "Not enough signal clarity to provide this section.",
            }
        )

    return enriched_sections


def render_sections_as_text(sections: list[dict[str, str]]) -> str:
    text_blocks: list[str] = []
    for index, section in enumerate(sections, start=1):
        title = section.get("title", f"Section {index}")
        content = section.get("content", "").strip()
        text_blocks.append(f"{index}. {title}\n{content}")
    return "\n\n".join(text_blocks)


async def fetch_stock_news(ticker: str) -> list[dict]:
    try:
        normalized_ticker = ticker.strip().upper()
        base_ticker = normalized_ticker.split(".")[0]
        company_name = None

        try:
            ticker_info = yf.Ticker(normalized_ticker).info
            company_name = ticker_info.get("shortName") or ticker_info.get("longName")
        except Exception as info_error:
            logger.warning("Unable to resolve company name for %s: %s", normalized_ticker, info_error)

        company_name_normalized = str(company_name).strip() if company_name else ""

        stop_words = {
            "limited",
            "ltd",
            "inc",
            "corporation",
            "corp",
            "plc",
            "company",
            "co",
            "the",
            "and",
            "holdings",
            "group",
        }

        company_tokens = [
            token.lower()
            for token in re.split(r"[^a-zA-Z0-9]+", company_name_normalized)
            if token and len(token) >= 3 and token.lower() not in stop_words
        ]

        allow_base_symbol_word_match = len(base_ticker) <= 5 or any(char.isdigit() for char in base_ticker)
        base_symbol_pattern = re.compile(rf"\b{re.escape(base_ticker.lower())}\b") if allow_base_symbol_word_match else None

        finance_context_keywords = {
            "stock",
            "stocks",
            "share",
            "shares",
            "market",
            "markets",
            "investor",
            "investors",
            "earnings",
            "quarter",
            "results",
            "profit",
            "revenue",
            "dividend",
            "valuation",
            "bse",
            "nse",
            "sensex",
            "nifty",
            "brokerage",
            "target price",
            "guidance",
        }

        blocked_source_keywords = {
            "pypi",
            "npm",
            "packagist",
            "rubygems",
            "crates.io",
        }

        relevance_terms = {base_ticker.lower(), normalized_ticker.lower(), normalized_ticker.replace(".", "").lower()}
        relevance_terms.update(company_tokens)

        def is_relevant_article(article: dict[str, Any]) -> bool:
            title = str(article.get("title") or "")
            description = str(article.get("description") or "")
            source = article.get("source") if isinstance(article.get("source"), dict) else {}
            source_name = str(source.get("name") or "")
            combined_text = f"{title} {description} {source_name}".lower()
            company_phrase = company_name_normalized.lower().strip()

            if any(keyword in source_name.lower() for keyword in blocked_source_keywords):
                return False

            has_finance_context = any(keyword in combined_text for keyword in finance_context_keywords)
            has_normalized_ticker = normalized_ticker.lower() in combined_text
            has_base_symbol = bool(base_symbol_pattern and base_symbol_pattern.search(combined_text))
            has_company_phrase = bool(company_phrase and company_phrase in combined_text)

            company_token_hits = 0
            for token in company_tokens:
                if token in combined_text:
                    company_token_hits += 1

            if has_company_phrase:
                return True

            if company_name_normalized and len(company_tokens) >= 2 and company_token_hits >= 2:
                return True

            if has_normalized_ticker and (has_finance_context or company_token_hits >= 1):
                return True

            if has_base_symbol:
                # Acronym-only matches (e.g., IOC as International Olympic Committee) are noisy.
                # Require either finance context or at least one company token to keep relevance high.
                if has_finance_context or company_token_hits >= 1:
                    return True

            if company_token_hits >= 1 and has_finance_context:
                return True

            return False

        query_candidates: list[str] = []
        if company_name_normalized:
            query_candidates.append(f'"{company_name_normalized}"')
            query_candidates.append(company_name_normalized)
        query_candidates.extend([base_ticker, normalized_ticker])

        seen_queries: set[str] = set()
        seen_urls: set[str] = set()
        seen_titles: set[str] = set()
        collected_articles: list[dict] = []

        async with httpx.AsyncClient(timeout=12.0) as http_client:
            for query_value in query_candidates:
                cleaned_query = query_value.strip()
                if not cleaned_query or cleaned_query in seen_queries:
                    continue

                seen_queries.add(cleaned_query)
                params = {
                    "q": cleaned_query,
                    "sortBy": "publishedAt",
                    "language": "en",
                    "searchIn": "title,description",
                    "pageSize": 20,
                    "apiKey": NEWS_API_KEY,
                }

                response = await http_client.get("https://newsapi.org/v2/everything", params=params)
                response.raise_for_status()
                payload = response.json()
                articles = payload.get("articles", []) if isinstance(payload, dict) else []
                if not isinstance(articles, list):
                    continue

                for article in articles:
                    if not isinstance(article, dict):
                        continue

                    if not is_relevant_article(article):
                        continue

                    article_url = article.get("url")
                    article_title = str(article.get("title") or "").strip().lower()
                    if isinstance(article_url, str) and article_url in seen_urls:
                        continue
                    if article_title and article_title in seen_titles:
                        continue

                    source = article.get("source") if isinstance(article.get("source"), dict) else {}
                    formatted = {
                        "title": article.get("title"),
                        "source": source.get("name"),
                        "url": article_url,
                        "published_at": article.get("publishedAt"),
                        "description": article.get("description"),
                    }
                    collected_articles.append(formatted)
                    if isinstance(article_url, str) and article_url:
                        seen_urls.add(article_url)
                    if article_title:
                        seen_titles.add(article_title)

                if len(collected_articles) >= 5:
                    break

        if not collected_articles:
            logger.info("No relevant NewsAPI articles found for %s using terms %s", normalized_ticker, sorted(relevance_terms))
            return []

        collected_articles.sort(key=lambda item: item.get("published_at") or "", reverse=True)
        return collected_articles[:5]
    except Exception as news_error:
        logger.exception("News API fetch failed for %s: %s", ticker, news_error)
        return []


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
    return f"v2_{ticker}_{range_key}"


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


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "stock-assistant-backend",
        "timestamp_utc": datetime.now(UTC).isoformat(),
    }


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
            cached_news = cached_analysis.get("news") if isinstance(cached_analysis, dict) else None
            if not isinstance(cached_news, list) or len(cached_news) == 0:
                news_articles = await fetch_stock_news(resolved_symbol)
                cached_analysis["news"] = news_articles
                set_cached_value(cache_key, range_key, cached_analysis)

            cached_text = cached_analysis.get("analysis_text") if isinstance(cached_analysis, dict) else None
            if isinstance(cached_text, str) and cached_text.strip():
                normalized_cached_text = normalize_analysis_text(cached_text)
                cached_sections = build_analysis_sections(normalized_cached_text)
                cached_indicators = cached_analysis.get("indicators") if isinstance(cached_analysis, dict) else {}
                cached_scores = cached_analysis.get("scores") if isinstance(cached_analysis, dict) else {}
                enriched_cached_sections = enrich_analysis_sections_with_data(
                    cached_sections,
                    resolved_symbol,
                    cached_indicators if isinstance(cached_indicators, dict) else {},
                    cached_scores if isinstance(cached_scores, dict) else {},
                )
                cached_analysis["analysis_sections"] = enriched_cached_sections
                cached_analysis["analysis_text"] = render_sections_as_text(enriched_cached_sections)
                set_cached_value(cache_key, range_key, cached_analysis)
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

        news_articles = await fetch_stock_news(resolved_symbol)

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
            "You are a senior financial analyst writing a comprehensive, investor-friendly stock research note.\n\n"
            "Explain the stock using only the provided indicators and computed scores.\n\n"
            "Rules:\n"
            "- Use simple, clear language.\n"
            "- Be comprehensive, with detailed reasoning in each section.\n"
            "- Explain what each indicator implies and why it matters.\n"
            "- Connect trend, momentum, volatility, and fundamentals into one coherent view.\n"
            "- Explain contradictions explicitly (e.g., moderate risk but strong bearish bias).\n"
            "- Include near-term vs medium-term interpretation where possible from the given inputs.\n"
            "- Mention key upside and downside triggers based strictly on provided data.\n"
            "- Include practical risk considerations and scenario framing.\n"
            "- Keep tone professional and neutral.\n"
            "- Do not generate new numbers.\n"
            "- Base conclusions strictly on provided data.\n"
            "- Keep it structured and detailed; avoid being brief.\n"
            "- In every section, explicitly reference relevant metrics from the input data.\n"
            "- End with a concise action-oriented conclusion for a cautious retail investor.\n\n"
            "Use this exact structure:\n"
            "1. Executive Summary\n"
            "2. Trend Position\n"
            "3. Momentum Signals\n"
            "4. Volatility & Risk Context\n"
            "5. Fundamentals Snapshot\n"
            "6. Bullish Case vs Bearish Case\n"
            "7. Final Interpretation\n\n"
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
{resolved_symbol} currently shows a {directional_bias.lower()} setup, with buy probability at {buy_probability}% versus sell probability at {sell_probability}%. Confidence is {confidence_score}/100 and risk is {risk_level.lower()} at {risk_score}/100, indicating the signal quality is {"strong" if confidence_score >= 70 else "moderate" if confidence_score >= 40 else "limited"}. The overall picture is not one-dimensional: market direction, momentum quality, and risk conditions are interacting rather than pointing to an unambiguous trend.

2. Trend Position
{trend_position_text} Relative positioning against moving averages suggests the market currently favors {"trend continuation" if latest_price > (sma_50 if sma_50 is not None else latest_price) else "defensive positioning"}. Trend alignment across time context is {"consistent" if trend_alignment else "mixed"}, which affects conviction and holding-period expectations.

3. Momentum Signals
{momentum_text} RSI and MACD together indicate whether current moves are supported by improving participation or are likely counter-trend bounces. If RSI remains weak while MACD is still below durable confirmation levels, rebounds may be fragile. If momentum strengthens with improving structure, downside pressure can moderate.

4. Volatility & Risk Context
{volatility_text}
{contradiction_note}
Risk conditions suggest position sizing and stop discipline should be emphasized. Even when directional probability appears favorable, elevated volatility or mixed internals can produce sharp adverse moves.

5. Fundamentals Snapshot
{fundamentals_text} Profitability, leverage, and cash-flow efficiency should be interpreted together; isolated metric strength is less reliable when balance-sheet pressure is high. Valuation context should be treated as secondary to trend and momentum in short-horizon decisions.

6. Bullish Case vs Bearish Case
Bullish case: directional momentum stabilizes, selling pressure eases, and trend structure improves enough to support follow-through buying.
Bearish case: weak momentum persists, resistance zones hold, and risk conditions force further de-rating in sentiment and price action.

7. Final Interpretation
Overall bias remains {directional_bias}. The {buy_probability}/{sell_probability} split implies {"buyers currently have an edge" if buy_probability > sell_probability else "sellers currently have an edge" if sell_probability > buy_probability else "a balanced setup"}, but conviction should be calibrated to confidence ({confidence_score}/100) and risk ({risk_level}, {risk_score}/100). For cautious execution, prioritize confirmation over prediction and align exposure with current risk regime.
"""

            result_payload = {
                "scores": scores,
                "indicators": indicators,
                "analysis_text": "",
                "analysis_sections": [],
                "news": news_articles,
            }
            normalized_fallback = normalize_analysis_text(fallback_report.strip())
            fallback_sections = build_analysis_sections(normalized_fallback)
            enriched_fallback_sections = enrich_analysis_sections_with_data(fallback_sections, resolved_symbol, indicators, scores)
            result_payload["analysis_sections"] = enriched_fallback_sections
            result_payload["analysis_text"] = render_sections_as_text(enriched_fallback_sections)
            set_cached_value(cache_key, range_key, result_payload)
            return result_payload

        normalized_response_text = normalize_analysis_text(response.text)
        response_sections = build_analysis_sections(normalized_response_text)
        enriched_response_sections = enrich_analysis_sections_with_data(response_sections, resolved_symbol, indicators, scores)
        result_payload = {
            "scores": scores,
            "indicators": indicators,
            "analysis_text": render_sections_as_text(enriched_response_sections),
            "analysis_sections": enriched_response_sections,
            "news": news_articles,
        }
        set_cached_value(cache_key, range_key, result_payload)
        return result_payload

    except Exception as e:
        return {"error": str(e)}

# Run the FastAPI server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)