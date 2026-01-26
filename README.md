# NSE Historical Stock Data Explorer 📈🤖

A premium, end-to-end financial analysis platform that combines real-time Google Finance data with the analytical power of the Groq Llama-3 AI.

### 🚀 Live Demo (Hosted on Google Sites)
[View Live Project](https://sites.google.com/view/stock4u/home)

---

## ✨ Features

- **📊 Advanced Charting**: Interactive Candlestick charts with synced RSI indicators and SMA (7/14) overlays.
- **🧠 AI Analyst Insights**: Intelligent, date-specific market sentiment analysis powered by Groq (Llama-3.3-70B), providing dense, high-quality 4-pointer summaries.
- **🔍 Smart Autocomplete**: Zero-latency fuzzy search for 500+ NSE symbols and company names.
- **✨ Premium UI/UX**: Professional "Dribbble-style" Dark/Light mode toggle, glowing micro-animations, and glassmorphic design.
- **🔮 Trend Forecasting**: 5-day linear trend projection for forward-looking price action.
- **📋 Persistent Watchlist**: Local browser storage for your favorite stocks.

---

## 🛠️ System Architecture

This project follows a **Decoupled Architecture** (Hybrid Frontend + Serverless Backend):

1.  **Frontend**: Built with Vanilla JS, Tailwind CSS, and Chart.js. High-contrast and accessibility-optimized.
2.  **Serverless Backend**: Google Apps Script acting as a JSON API, interfaced with Google Sheets and the `GOOGLEFINANCE` engine.
3.  **AI Layer**: Groq Cloud API for real-time natural language market sentiment.

---

## 📦 Local Setup

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/dARSHANdR4/International-Education-Cost-Predictor.git
    ```
2.  **API Keys**:
    - Open `index.html` and add your **Groq API Key** at the top.
    - Deploy the `Code.gs` as a Google Web App and paste the URL in `index.html`.
3.  **Run**: Just open `index.html` in any modern browser!

---

## 📜 Technical Stack
- **Frontend**: HTML5, Tailwind CSS, JS (ES6+)
- **Charts**: Chart.js 4.x (Financial & Timeseries)
- **AI**: Groq API (Llama-3.3)
- **Data Engine**: Google Finance via Google Apps Script

---

*Built with ❤️ for professional financial exploration.*
