from fastapi import FastAPI
import google.generativeai as genai
import yfinance as yf
import pandas as pd
import numpy as np
import pandas_ta as ta
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Retrieve the API key from environment variables
API_KEY = os.getenv("GEMINI_API_KEY")

# Check if the API key is properly loaded
if not API_KEY:
    raise ValueError("GEMINI_API_KEY is not set. Please check your .env file.")

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your Next.js frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up Gemini AI
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-1.5-pro")


@app.get("/api/stock/{ticker_symbol}")  # Updated path to match frontend
async def get_stock_analysis(ticker_symbol: str):
    try:
        # Fetch stock data
        ticker = yf.Ticker(ticker_symbol)
        latest_price = ticker.history(period="1d").iloc[-1].Close

        # Historical Data for Technical Indicators
        data = ticker.history(period='1y')

        # Moving Averages
        sma_50 = ta.sma(data['Close'], length=50).iloc[-1]
        ema_20 = ta.ema(data['Close'], length=20).iloc[-1]

        # RSI Calculation
        rsi = ta.rsi(data['Close'], length=14).iloc[-1]

        # MACD Calculation
        macd_df = ta.macd(data['Close'])
        macd_value = macd_df['MACD_12_26_9'].iloc[-1]
        macd_signal = macd_df['MACDs_12_26_9'].iloc[-1]

        # Bollinger Bands (BB)
        bbands = ta.bbands(data['Close'], length=20)
        bb_upper = bbands['BBU_20_2.0'].iloc[-1]  # Upper band
        bb_lower = bbands['BBL_20_2.0'].iloc[-1]  # Lower band

        # Average True Range (ATR)
        atr = ta.atr(data['High'], data['Low'], data['Close'], length=14).iloc[-1]

        # Stochastic Oscillator
        stoch = ta.stoch(data['High'], data['Low'], data['Close'], k=14, d=3)
        stoch_k = stoch['STOCHk_14_3_3'].iloc[-1]
        stoch_d = stoch['STOCHd_14_3_3'].iloc[-1]

        # On-Balance Volume (OBV)
        obv = ta.obv(data['Close'], data['Volume']).iloc[-1]

        # Fundamental Data
        info = ticker.info
        fundamentals = {
            "Revenue": info.get("totalRevenue", "N/A"),
            "Market Cap": info.get("marketCap", "N/A"),
            "Profit Margin": info.get("profitMargins", "N/A"),
            "P/E Ratio": info.get("trailingPE", "N/A"),
            "P/B Ratio": info.get("priceToBook", "N/A"),
        }

        # Stock Analysis Report Prompt
        stock_data_prompt = f"""
        Generate a structured and insightful stock analysis report for {ticker_symbol}.
        """

        response = model.generate_content(stock_data_prompt)

        # Structured JSON Response
        return {
            "ticker_symbol": ticker_symbol,
            "latest_price": latest_price,
            "technical_indicators": {
                "SMA_50": sma_50,
                "EMA_20": ema_20,
                "RSI": rsi,
                "MACD": {
                    "Value": macd_value,
                    "Signal": macd_signal
                },
                "Bollinger_Bands": {
                    "Upper": bb_upper,
                    "Lower": bb_lower
                },
                "ATR": atr,
                "Stochastic_Oscillator": {
                    "K": stoch_k,
                    "D": stoch_d
                },
                "OBV": obv
            },
            "fundamentals": fundamentals,
            "generated_report": response.text  # AI-generated stock analysis
        }

    except Exception as e:
        return {"error": str(e)}

# Run the FastAPI server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
