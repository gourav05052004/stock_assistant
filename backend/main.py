from fastapi import FastAPI
import google.generativeai as genai
import yfinance as yf
import pandas as pd
import pandas_ta as ta
from fastapi.middleware.cors import CORSMiddleware
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
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-1.5-pro")


@app.get("/api/stock/{ticker_symbol}")
async def get_stock_analysis(ticker_symbol: str):
    try:
        # Fetch stock data
        ticker = yf.Ticker(ticker_symbol)
        history = ticker.history(period="1y")

        # Ensure data is available
        if history.empty:
            return {"error": f"No stock data found for {ticker_symbol}"}

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
        macd_value = macd["MACD_12_26_9"].iloc[-1]
        macd_signal = macd["MACDs_12_26_9"].iloc[-1]

        # Extract Bollinger Bands values
        bb_upper = bbands["BBU_20_2.0"].iloc[-1]
        bb_lower = bbands["BBL_20_2.0"].iloc[-1]

        # Extract Stochastic Oscillator values
        stoch_k = stoch["STOCHk_14_3_3"].iloc[-1]
        stoch_d = stoch["STOCHd_14_3_3"].iloc[-1]

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
        Generate a detailed and structured stock analysis report for {ticker_symbol}.
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

        response = model.generate_content(stock_data_prompt)

        # Ensure AI generated a valid response
        if not response.text:
            return {"error": "AI failed to generate a stock report."}

        return {"stock_analysis": response.text}

    except Exception as e:
        return {"error": str(e)}

# Run the FastAPI server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)