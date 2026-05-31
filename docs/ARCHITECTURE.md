# ARCHITECTURE.md

> System design, data flow, and decision rationale for NSE Paper Trader.

---

## System Overview

NSE Paper Trader is a three-tier web application:

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                       │
│  React SPA (Vite)                                       │
│  - Option chain viewer with live updates                │
│  - Paper order placement UI                             │
│  - Portfolio / P&L dashboard                            │
│  - Strategy builder with payoff diagram                 │
└──────────────┬───────────────────────┬──────────────────┘
               │ REST API              │ WebSocket
               │ (TanStack Query)      │ (live ticks)
               ▼                       ▼
┌─────────────────────────────────────────────────────────┐
│                 OUR FASTAPI BACKEND                     │
│  - Paper order engine (fills, slippage, charges)        │
│  - Dhan API proxy with Redis caching                    │
│  - WebSocket proxy for live market feed                 │
│  - Greeks & payoff calculation engine                   │
│  - JWT authentication                                   │
└──────┬──────────────┬────────────────┬──────────────────┘
       │              │                │
       ▼              ▼                ▼
  PostgreSQL       Redis 7         Dhan API
  (paper trades,  (live price    (market data,
   positions,      cache,         option chain,
   P&L history,   WS sub list,   quotes —
   user accounts) session data)  READ-ONLY)
```

---

## Why This Architecture

### Separate Backend (not direct browser → Dhan)
Dhan's access token cannot be exposed in the browser — it would allow real order
placement. Our backend holds the token server-side, proxies only read-only data calls,
and signs all responses with our own JWT.

### Redis for Caching
Dhan allows 10 data API requests/second. A busy option chain with 100+ strikes and 10
concurrent users would easily hit this limit without caching. Redis stores the option
chain for each symbol:expiry pair with a 30-second TTL during market hours.

### WebSocket Proxy
Dhan's WebSocket feed requires the access token in the connection. We open one
authenticated connection to Dhan per server instance, then fan out tick data to all
connected browser clients. This keeps one Dhan WS connection alive rather than N
(one per user).

### PostgreSQL for Paper Trades
Paper trades are the app's primary data. They need ACID transactions (deduct margin
and record the order atomically), complex queries (P&L by date range, win rate), and
reliability. SQLite would work for a single user but PostgreSQL scales to many.

---

## Request Lifecycle — Place a Paper Order

```
1. User clicks "Buy 1 Lot NIFTY 24500 CE" in OptionChainTable
2. OrderTicket mounts inline with pre-filled strike data
3. User selects: Market order, 1 lot, confirms
4. Frontend: usePaperOrder.placePaperOrder({ security_id, qty, action, order_type })
5. → POST /api/paper/orders (our backend)
6. Backend auth middleware validates JWT → extracts user_id
7. paper_engine.fill_paper_order() called:
   a. ist_clock.is_market_open() → True
   b. instruments lookup → lot_size=75, exchange_segment=NSE_FNO
   c. 75 % 75 == 0 → valid
   d. cache_service.get_ltp("NIFTY-24500-CE-25JAN") → cache hit: ₹245.50
   e. slippage.compute(245.50, "MARKET", "ATM") → fill_price = ₹246.00 (+0.50 slip)
   f. charges.compute(246.00, 75) → total_charges = ₹62.30
   g. margin_service.compute(BUY, 246.00, 75) → margin_required = ₹18,450 (premium)
   h. user.virtual_cash - user.margin_used = ₹8,50,000 >= ₹18,450 → OK
   i. DB transaction:
      - INSERT paper_order (FILLED, fill_price=24600 paise)
      - INSERT position (qty=75, avg_entry=24600 paise)
      - UPDATE user SET margin_used += 1845000 (₹18,450 in paise)
8. Response: { order_id, fill_price: "₹246.00", charges: "₹62.30", status: "FILLED" }
9. Frontend: Toast shows "✓ Bought 1 lot NIFTY 24500 CE at ₹246.00"
10. portfolioStore updates: positions list refreshes via TanStack Query invalidation
```

---

## WebSocket Lifecycle — Live P&L Updates

```
1. App loads → useDhanWebSocket hook connects: ws://localhost:8000/ws/market-feed?token=<jwt>
2. Backend: validates JWT, looks up user's open positions from DB
3. Backend: adds those security_ids to Redis set "ws_subscriptions:{user_id}"
4. Backend: ensures Dhan WS is subscribed to those security_ids
5. Dhan sends a tick: { security_id: "NIFTY-24500-CE", ltp: 252.75 }
6. Backend: updates Redis cache for this security_id (TTL 5s)
7. Backend: fans out to all users who have this security_id in their subscription set
8. Frontend receives: { security_id, ltp: 25275 (paise), timestamp }
9. useDhanWebSocket dispatches to portfolioStore:
   - Find position with matching security_id
   - unrealized_pnl = (25275 - position.avg_entry) × position.quantity
   - Update daily_pnl, total_pnl
10. PriceTag components re-render with flash animation
11. MTMCard updates with new P&L number
```

---

## Option Chain Data Flow

```
1. User visits /option-chain, selects NIFTY + expiry
2. useOptionChain hook fires: GET /api/option-chain?symbol=NIFTY&expiry=2024-01-25
3. Backend: check Redis key "option_chain:NIFTY:2024-01-25"
   → HIT: return cached JSON (age shown in response header X-Cache-Age)
   → MISS:
     a. Call Dhan: GET https://api.dhan.co/v2/optionchain
        with headers: { client-id, access-token }
        with body: { UnderlyingSymbol: "NIFTY", ExpiryDate: "2024-01-25" }
     b. Dhan returns: full option chain with CE/PE for every strike
        including: ltp, oi, volume, iv, delta, gamma, theta, vega, rho per strike
     c. Store in Redis with TTL=30s (market hours) or TTL=3600s (post-market)
     d. Return to client
4. Frontend maps response to OptionChain type
5. OptionChainTable renders all strikes
6. ATM strike identified: find strike closest to spotPrice
7. Strikes sorted: ATM in center, ITM above (for calls), OTM below
8. TanStack Query refetches every 30s automatically during market hours
```

---

## Greeks Data Flow

Dhan supplies Greeks directly in the option chain response. This is ideal — we use them.

If a strike's Greeks are missing (Dhan sometimes omits far OTM strikes):
- Backend: `greeks_service.compute_greeks(spot, strike, expiry, iv, risk_free_rate, option_type)`
- Uses Black-Scholes (see `docs/GREEKS.md`)
- Returns: `{ delta, gamma, theta, vega, rho }`
- This fallback is logged so we can monitor how often it's needed

Portfolio-level Greeks:
- `GET /portfolio` computes net portfolio Greeks
- net_delta = Σ(position.quantity × position.delta × position.direction_multiplier)
  - direction_multiplier: +1 for long, -1 for short
- Similarly for gamma, theta, vega

---

## Authentication Flow

```
1. User goes to /settings (or /login on first visit)
2. Enters Dhan Client ID + Access Token from developer.dhanhq.co
3. POST /auth/login → backend issues our own JWT (24hr expiry)
4. JWT stored in httpOnly cookie (not localStorage — XSS protection)
5. All subsequent API calls: cookie sent automatically
6. Backend middleware validates JWT on every protected route
7. When our JWT expires: frontend redirects to /login
8. When Dhan token expires (daily): backend returns { dhan_token_expired: true }
   → frontend shows "Please refresh your Dhan API token" banner
```

---

## Market Hours Logic

`backend/src/utils/ist_clock.py` governs all time-aware behavior.

```
is_pre_open(): 09:00 ≤ IST < 09:15 and not holiday
is_market_open(): 09:15 ≤ IST ≤ 15:30 and not holiday
is_market_closed(): IST > 15:30 or holiday
is_holiday(date): checks against market_calendar.HOLIDAYS set
get_current_expiry(): next Thursday (weekly) or last Thursday of month
get_time_to_expiry_years(): (expiry_datetime - now) / 365 — used in B-S
```

Frontend mirrors this logic in `hooks/useMarketStatus.ts` for UI gating.

---

## Error Handling Strategy

### Backend Errors → HTTP codes + JSON body
```
400 Bad Request     → validation failed (lot size, invalid symbol)
401 Unauthorized    → JWT missing or expired
402 Payment Required → insufficient virtual margin
403 Forbidden       → market closed (trading action attempted)
404 Not Found       → position/order not found
409 Conflict        → cannot cancel a filled order
422 Unprocessable   → Pydantic validation error (wrong types)
502 Bad Gateway     → Dhan API returned an error (pass through with context)
503 Service Unavail  → Redis or DB unreachable
```

### Frontend Error Handling
- All errors surface via Toast (non-blocking, 5 second timeout)
- 401 → redirect to /login automatically (axios interceptor)
- 402 → show "Insufficient margin" inline in OrderTicket (not just Toast)
- 403 (market closed) → disable all "Buy"/"Sell" buttons; show "Market Closed" badge
- 502 → show "Market data temporarily unavailable. Using last known prices."

---

## Scalability Notes (For Future)

This is built for personal/small team use. To scale to many users:
- Replace single Dhan WS connection with a pool (one per N users)
- Add connection pooling (pgbouncer) in front of PostgreSQL
- Add a job queue (Celery + Redis) for heavy background tasks (EOD reports)
- Kubernetes for multi-instance backend (stateless FastAPI)
- The Redis pub/sub fan-out pattern already works for horizontal scaling
