# NSE Historical Stock Data Explorer (StockPulse) 📈🤖

A historical NSE stock analysis dashboard with candlestick charts, RSI, SMA overlays, a simple trend projection, a local watchlist, Google Apps Script/Google Sheets data access, and optional AI commentary powered by Groq.

## Features

- Interactive candlestick chart with 7-day and 14-day simple moving averages
- RSI (14) indicator and a five-day linear trend projection
- NSE ticker/company autocomplete and browser-local watchlist
- Historical data through Google Apps Script and Google Finance
- Optional AI commentary through a server-side Groq endpoint

## Architecture

- **Frontend:** `index.html` (Vanilla JavaScript, Tailwind CSS, Chart.js)
- **Historical data:** `Code.gs` (Google Apps Script + Google Sheets/GOOGLEFINANCE)
- **AI endpoint:** `functions/api/insights.js` (Cloudflare Pages Function)
- **Health endpoint:** `functions/api/health.js`

The Groq API key must stay in a Cloudflare server-side secret. Do not paste a real API key into `index.html`, commit it to GitHub, or share it in chat.

## Deploy to Cloudflare Pages

1. Push this branch to GitHub and connect this repository to Cloudflare Pages.
2. Set the build command to none (leave it blank) and the build output directory to `.` (repository root).
3. In the Cloudflare Pages project, open **Settings → Variables and Secrets** (or **Environment variables**, depending on the UI) and add:
   - `GROQ_API_KEY`: your Groq API key, stored as a secret/encrypted variable.
   - `GROQ_MODEL` (optional): `openai/gpt-oss-120b`. If omitted, the function uses this model by default.
4. Trigger a deployment from branch `fix/stockpulse-groq-cloudflare`.
5. After the deployment succeeds, open `https://YOUR-PAGES-DOMAIN/api/health`. The response should contain `{"ok":true,"service":"stockpulse-api"}`.
6. In `index.html`, replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with your deployed Google Apps Script Web App URL, commit that change, and redeploy. The Apps Script deployment must allow the intended users to access it. Do not publish any credentials in that URL.

## Deploy the Google Apps Script data API

1. Open the Google Apps Script project linked to your spreadsheet.
2. Ensure `Code.gs` contains the code in this repository and that the script is bound to the spreadsheet that provides the data.
3. Choose **Deploy → New deployment → Web app**.
4. Select the execution identity and access scope appropriate for your own setup, then deploy.
5. Copy the Web App URL ending in `/exec` and paste it into `APPS_SCRIPT_URL` in `index.html`.
6. If you change the Apps Script code later, create a new version or update the existing deployment so the Web App runs the latest code.

Never share your Google account password, deployment credentials, or Groq key. Only share the Web App URL if you are comfortable with its configured access scope.

## Test checklist

- `/api/health` returns an `ok: true` response.
- The app can fetch a symbol and a historical date through the Apps Script API.
- A weekend/market holiday shows the latest available trading close on or before the requested date, and the displayed date matches that close.
- AI Insights responds without exposing the Groq key in browser developer tools or page source.
- Missing/invalid Groq credentials produce a readable error rather than breaking the stock chart.

## Local setup

Clone the repository:

```bash
git clone https://github.com/dARSHANdR4/Stock-Market_NSE-Real-Time.git
cd Stock-Market_NSE-Real-Time
```

The frontend can be opened locally for visual inspection, but the `/api/insights` endpoint requires Cloudflare Pages Functions (or a compatible local Pages development server). Do not put a real Groq API key in frontend JavaScript.

## Important notes

- AI commentary analyzes the supplied historical prices only; it does not automatically fetch historical news or company fundamentals.
- The trend projection is a simple linear extrapolation, not a reliable prediction of future prices.
- Google Finance availability and historical coverage may vary by symbol and date.
