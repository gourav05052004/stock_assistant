# Stock Assistant

AI-powered stock analysis assistant with a **Next.js frontend** and **FastAPI backend**.

The app fetches market data, computes technical/fundamental indicators, enriches context with news, and returns a structured AI analysis report.

---

## Features

- Search stocks by ticker symbol (including Indian market suffix support like `.NS` and `.BO` fallback in backend).
- Multi-timeframe charting (`1W`, `1M`, `6M`, `1Y`) with dynamic API fetch.
- Structured analysis sections (executive summary, trend, momentum, volatility/risk, fundamentals, bullish vs bearish, final interpretation).
- Risk and confidence scoring with buy/sell probabilities.
- News context integration for the selected stock.
- Export analysis report to PDF from the results page.

---

## Tech Stack

### Frontend
- Next.js 15 (App Router)
- React 19 + TypeScript
- Tailwind CSS
- Recharts
- Lucide icons
- jsPDF

### Backend
- FastAPI
- Uvicorn
- yfinance
- pandas + pandas-ta
- Google GenAI SDK (`google-genai`)
- httpx

---

## Project Structure

```text
bot/
├─ frontend/                  # Main Next.js app used for UI
│  ├─ app/
│  │  ├─ page.tsx             # Landing page
│  │  ├─ results/page.tsx     # Analysis report UI
│  │  └─ api/stock/[ticker]/route.ts  # API proxy to backend
│  └─ components/ui/          # Reusable UI components
├─ backend/
│  ├─ main.py                 # FastAPI app and stock analysis logic
│  └─ requirements.txt
└─ README.md
```

> Note: There is also a root-level `app/` folder in this repo. Current active Next.js app is under `frontend/`.

---

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+
- API keys:
	- Gemini API key
	- News API key

---

## Environment Variables

Create a `.env` file inside `backend/`:

```env
GEMINI_API_KEY=your_gemini_api_key
NEWS_API_KEY=your_news_api_key
```

The backend validates both keys on startup and fails fast if missing.

---

## Installation

### 1) Backend setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

### 2) Frontend setup

```bash
cd frontend
npm install
```

---

## Run the App (Development)

Run backend first:

```bash
cd backend
python main.py
```

Backend starts at `http://127.0.0.1:8000`.

Run frontend in another terminal:

```bash
cd frontend
npm run dev
```

Frontend starts at `http://localhost:3000`.

---

## API Overview

### Backend

- `GET /health`
	- Health check endpoint.

- `GET /api/stock/{ticker_symbol}`
	- Returns full stock analysis payload.
	- Query parameter: `range` (`1d`, `1w`, `1m`, `6m`, `1y`).
	- If `range` is present for chart refresh requests, backend can return chart-focused payload with `chartData`.

### Frontend API Route

- `frontend/app/api/stock/[ticker]/route.ts`
	- Proxies requests to backend URL: `http://127.0.0.1:8000/api/stock/{ticker}`.
	- Adds `range` query param when selected.

---

## Useful Scripts

From `frontend/`:

- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run start` – run production server
- `npm run lint` – lint frontend code

---

## Troubleshooting

- **Missing API keys**
	- Ensure `backend/.env` contains valid `GEMINI_API_KEY` and `NEWS_API_KEY`.

- **Frontend cannot fetch backend (503 / connection errors)**
	- Verify backend is running at `127.0.0.1:8000`.
	- Ensure no firewall/proxy is blocking local traffic.

- **CORS issues**
	- Backend currently allows `http://localhost:3000`.
	- Update `allow_origins` in `backend/main.py` if frontend host/port changes.

- **Module import errors in Next.js**
	- Ensure you are working inside `frontend/` app and imports resolve to `frontend/components/*`.

---

## Production Notes

- Replace hardcoded backend URL in `frontend/app/api/stock/[ticker]/route.ts` with an environment variable for deployment.
- Configure secure CORS origins for deployed frontend domains.
- Use process manager/container for backend (e.g., `uvicorn` with workers behind reverse proxy).

---

## Disclaimer

This project is for educational and informational purposes only. It does **not** constitute financial advice.
