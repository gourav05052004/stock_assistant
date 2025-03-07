from fastapi import FastAPI
import google.generativeai as genai
import yfinance as yf
import pandas as pd
import numpy as np
import pandas_ta as ta
from fastapi.middleware.cors import CORSMiddleware

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
genai.configure(api_key="AIzaSyCIwxrHj7Ro0ocxvVQygJARW4en9lP2VqQ")
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

        # Average True Range (ATR) - Volatility Indicator
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
        Generate a comprehensive and insightful stock analysis report for {ticker_symbol}.  
        Ensure the report is well-structured, informative, and actionable for investors.  
        Avoid including the date in the report.  

        also give the key abbreviations used in the report.
        Abbreviations:with their laymen definition

        ## **1. Stock Overview**  
        - Provide a brief introduction to {ticker_symbol}, including its core business operations, industry presence, and market positioning.  
        - Highlight any recent developments, news, or events that could impact the stock's performance.  

        ## **2. Latest Stock Performance**  
        - **Latest Closing Price**: {latest_price} INR  
        - Discuss how the stock has performed recently and its volatility trends.  

        ## **3. Technical Indicators & Analysis**  
        - **50-day Simple Moving Average (SMA):** {sma_50}  
        - **20-day Exponential Moving Average (EMA):** {ema_20}  
        - **Relative Strength Index (RSI):** {rsi}  
        - **MACD Value:** {macd_value} | **MACD Signal Line:** {macd_signal}  
        - **Bollinger Bands:** Upper {bb_upper}, Lower {bb_lower}  
        - **Average True Range (ATR):** {atr}  
        - **Stochastic Oscillator:** %K {stoch_k}, %D {stoch_d}  
        - **On-Balance Volume (OBV):** {obv}  
        - Identify major support and resistance levels.  

        ## **4. Fundamental Analysis**  
        - **Revenue:** {fundamentals["Revenue"]}  
        - **Market Capitalization:** {fundamentals["Market Cap"]}  
        - **Profit Margin:** {fundamentals["Profit Margin"]}  
        - **Price-to-Earnings (P/E) Ratio:** {fundamentals["P/E Ratio"]}  
        - **Price-to-Book (P/B) Ratio:** {fundamentals["P/B Ratio"]}  

        ## **5. Industry & Market Analysis**  
        - Discuss industry trends and external factors affecting {ticker_symbol}.  
        - Compare {ticker_symbol} with competitors.  

        ## **6. Risk Assessment**  
        - Identify market, company-specific, and sectoral risks.  

        ## **7. Investment Insights & Recommendations**  
        - Analyze stock valuation and suggest a buy/sell/hold strategy.  

        ## **8. Conclusion**  
        - Summarize key takeaways.  
        """

        response = model.generate_content(stock_data_prompt)
        return {"stock_analysis": response.text}

    except Exception as e:
        return {"error": str(e)}

# Run the FastAPI server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
