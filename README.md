# NSE Paper Trader

**Virtual options trading platform for Indian markets.** Simulate NIFTY, BANK NIFTY, and stock F&O options trading with live market data, real-time Greeks, and a professional dark-terminal UI. No real orders — no risk.

---

## Features

- **Live Option Chain** — Real-time NSE option chain with LTP, OI, IV, and Greeks per strike
- **Paper Trading** — Market, Limit, and SL order execution with slippage model
- **Virtual Portfolio** — Real-time MTM P&L, margin tracking, position management
- **Strategy Builder** — Multi-leg strategies with payoff diagrams and what-if scenarios
- **Analytics** — P&L charts, win rate, trade journal with CSV export
- **Risk Controls** — Stop-loss, daily loss limits, margin caps, max position limits
- **Supabase Auth** — Email/password sign-up and login
- **Subscription Tiers** — Free (₹2k capital), Basic (₹1L), Pro (₹50L), Elite (₹1Cr)

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query, Recharts |
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2.0 (async), APScheduler |
| Database | PostgreSQL 16 (via Supabase) |
| Auth | Supabase Auth (email/password) |
| Market Data | DhanHQ Data API (shared backend key) |
| Styling | Dark trading terminal — JetBrains Mono + IBM Plex Sans |

---

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.12+
- Supabase project (free tier)
- DhanHQ Data API subscription (₹499/mo)

### 1. Clone and install

```bash
git clone https://github.com/TechKnoWEB/NSE-Paper-Trader
cd nse-paper-trader

# Frontend
cd frontend
npm install

# Backend
cd ../backend
pip install -r requirements.txt
```

### 2. Configure environment

```bash
# Backend env
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, DHAN_CLIENT_ID, DHAN_ACCESS_TOKEN

# Frontend env
cp frontend/.env.example frontend/.env
# Fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

### 3. Run database migration

Run the SQL in [`schema.md`](./schema.md) in your Supabase SQL Editor.

### 4. Start the app

```bash
# Terminal 1 — Backend
cd backend
uvicorn src.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` — sign up, and start trading.

---

## Project Structure

```
nse-paper-trader/
├── frontend/                   # React SPA
│   └── src/
│       ├── components/         # UI components (layout, options, portfolio, strategy, charts, common)
│       ├── pages/              # Route pages (Dashboard, OptionChain, Positions, etc.)
│       ├── hooks/              # Custom React hooks
│       ├── store/              # Zustand state (market, portfolio, settings)
│       ├── services/           # API client, WebSocket manager
│       ├── utils/              # Formatters, Black-Scholes, colors
│       └── types/              # TypeScript interfaces
└── backend/                    # Python FastAPI server
    └── src/
        ├── api/                # Routers (auth, paper_orders, positions, option_chain, etc.)
        ├── services/           # Business logic (paper_engine, greeks, margin, P&L)
        ├── models/             # SQLAlchemy ORM models
        ├── middleware/         # Auth, rate limiting, logging
        ├── utils/              # B-S formula, slippage, charges, IST clock
        └── config/             # Settings, instruments, pricing, market calendar
```

### Key Endpoints

| Endpoint | Description |
|---|---|
| `POST /auth/session` | Create/restore user session via Supabase token |
| `GET /portfolio` | Virtual cash, margin, P&L, subscription tier |
| `GET /positions` | Open positions with live Greeks |
| `GET /option-chain` | Live option chain for selected index/expiry |
| `POST /paper/orders` | Place a paper trade (market/limit/SL) |
| `DELETE /paper/orders/:id` | Cancel pending limit order |
| `POST /portfolio/reset` | Close all positions, restore capital |
| `POST /strategy/payoff` | Server-side payoff table calculation |
| `GET /portfolio/pnl-history` | Daily P&L history for charts |
| `WS /ws/market-feed` | Real-time LTP ticks for open positions |

---

## Screenshots

(Add screenshots of Dashboard, Option Chain, Strategy Builder, and Analytics pages.)

---

## Documentation

- [`schema.md`](./schema.md) — Database schema and RLS policies
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — System design
- [`docs/GREEKS.md`](./docs/GREEKS.md) — Options math spec
- [`docs/PAPER_ENGINE.md`](./docs/PAPER_ENGINE.md) — Order execution rules
- [`docs/DATA_MODELS.md`](./docs/DATA_MODELS.md) — All database models
- [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) — Frontend guide
- [`backend/CLAUDE.md`](./backend/CLAUDE.md) — Backend API contract

---

## Important

- **Paper trading only** — no real orders are ever placed
- Not SEBI-registered investment advice
- Options trading carries significant risk
- Market data requires a DhanHQ Data API subscription

---

## License

MIT
