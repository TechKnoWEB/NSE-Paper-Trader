# BACKEND_SERVICES.md — Service Layer Specification

> Every file in `backend/src/services/`. What each service does, its function signatures,
> and its dependencies. No code — pure contract for the backend agent.

---

## dhan_client.py

The single source of truth for all Dhan API calls.
All other services call this — never call the `dhanhq` SDK directly elsewhere.

```
class DhanClient:
  __init__(client_id: str, access_token: str) → None
    Initializes dhanhq.Dhan instance and marketfeed.DhanFeed instance
    Called once at FastAPI startup, stored in app.state.dhan_client

  get_option_chain(symbol: str, expiry_date: str) → dict
    Calls: dhanhq GET /optionchain
    Returns: raw Dhan response (parsing done by option_chain router)
    Raises: DhanAuthError, DhanRateLimitError, DhanAPIError

  get_quotes(security_ids_by_segment: dict) → dict
    Calls: dhanhq GET /marketfeed/quote
    Input: { "NSE_FNO": ["43467", "43468"], "IDX_I": ["13"] }
    Returns: { segment: { security_id: { ltp, open, high, low, close, volume, oi } } }
    Raises: same as above

  get_historical(security_id, exchange_segment, instrument, from_date, to_date, interval) → dict
    Calls: dhanhq GET /charts/historical
    Returns: { open[], high[], low[], close[], volume[], timestamp[] }

  get_expiry_list(symbol: str) → list[str]
    Calls: dhanhq GET /optionchain/expirylist
    Returns: ["2024-01-25", "2024-02-01", ...]

  get_fund_limits() → dict
    Calls: dhanhq GET /fundlimit
    Returns: raw fund limit data

  start_feed(instruments: list[tuple]) → None
    Starts the DhanFeed WebSocket connection
    instruments: [(marketfeed.NSE_FO, "43467", marketfeed.Ticker), ...]

  subscribe_instruments(instruments: list[tuple]) → None
    Adds new instruments to the live feed subscription
    Called when a user opens a new paper position

  unsubscribe_instruments(instruments: list[tuple]) → None
    Removes instruments from feed when all users close positions in them

  get_latest_tick(security_id: str) → dict | None
    Returns last received tick for a security_id from in-memory tick store
    Used as last-resort fallback when Redis cache misses

  check_health() → dict
    Makes a lightweight Dhan API call (fund limits) to verify connectivity
    Returns: { "reachable": bool, "latency_ms": int, "error": str | None }
```

Error classes (in `utils/exceptions.py`):
- `DhanAuthError`: invalid credentials (DH-901, DH-902)
- `DhanRateLimitError`: rate limited (DH-904) — triggers backoff in caller
- `DhanAPIError`: other Dhan errors — includes original error code

---

## cache_service.py

All Redis interactions go through this service.

```
class CacheService:
  __init__(redis_url: str) → None
    Creates async Redis connection (redis.asyncio)

  get_option_chain(symbol: str, expiry: str) → dict | None
    Key: "option_chain:{symbol}:{expiry}"
    Returns: parsed dict or None if cache miss

  set_option_chain(symbol: str, expiry: str, data: dict, is_market_open: bool) → None
    TTL: 30s if is_market_open else 3600s

  get_quote(security_id: str) → dict | None
    Key: "quote:{security_id}"
    Returns: { ltp, open, high, low, close, volume } or None

  set_quote(security_id: str, data: dict) → None
    TTL: 5s

  get_ltp(security_id: str) → int | None
    Convenience: returns just the ltp in paise, or None

  get_historical(security_id, interval, from_date, to_date) → dict | None
    Key: "historical:{security_id}:{interval}:{from_date}:{to_date}"

  set_historical(security_id, interval, from_date, to_date, data: dict) → None
    TTL: 3600s

  get_expiry_list(symbol: str) → list[str] | None
    Key: "expiry_list:{symbol}"

  set_expiry_list(symbol: str, data: list) → None
    TTL: 21600s (6 hours)

  get_instruments_master() → dict | None
    Key: "instruments_master"
    Returns: { security_id: InstrumentInfo } or None

  set_instruments_master(data: dict) → None
    TTL: 86400s (24 hours)

  get_ws_subscriptions(user_id: str) → set[str]
    Key: "ws_subscriptions:{user_id}"
    Returns: set of security_ids the user is subscribed to

  add_ws_subscription(user_id: str, security_id: str) → None
    SADD to "ws_subscriptions:{user_id}", TTL 86400s

  remove_ws_subscription(user_id: str, security_id: str) → None
    SREM from "ws_subscriptions:{user_id}"

  publish_tick(security_id: str, tick_data: dict) → None
    Redis PUBLISH to channel "ticks:{security_id}"
    Used by WS proxy to fan out ticks to subscribed browser clients
```

---

## paper_engine.py

Core virtual order execution. See `docs/PAPER_ENGINE.md` for full rules.

```
class PaperEngine:
  __init__(db: AsyncSession, cache: CacheService, dhan: DhanClient) → None

  async fill_paper_order(order: PaperOrderCreate, user: User) → PaperOrder
    Implements all 10 steps from PAPER_ENGINE.md
    Atomic DB transaction for step 9

  async close_position(position: Position, quantity: int, user: User) → Trade
    Implements close logic from PAPER_ENGINE.md
    Atomic DB transaction

  async cancel_order(order_id: UUID, user: User) → PaperOrder
    Status must be PENDING or raises ConflictError
    Releases margin, updates order status to CANCELLED

  async expire_positions(today: date) → list[Trade]
    Called at 15:30 IST on expiry days by APScheduler
    Settles all positions expiring today
    Returns list of auto-created Trade records

  async check_limit_orders(current_ticks: dict[str, int]) → list[PaperOrder]
    Called every 5 seconds during market hours
    Checks all PENDING limit orders against current prices
    Fills any whose conditions are met
    Returns list of orders that were filled

  async _get_fill_price(security_id: str, order_type: str, action: str) → int
    Private: fetches LTP from cache, applies slippage
    Returns fill price in paise

  async _validate_order(order: PaperOrderCreate, user: User) → None
    Private: runs all validation rules V1-V5 from PAPER_ENGINE.md
    Raises specific exceptions for each failure
```

---

## greeks_service.py

Black-Scholes calculations. See `docs/GREEKS.md` for all formulas.

```
class GreeksService:
  __init__(risk_free_rate: float) → None
    risk_free_rate from settings (RBI repo rate)

  compute_option_price(S, K, T, sigma, option_type) → float
    S, K in rupees (not paise)
    T in years
    sigma as decimal (0.18 = 18%)
    option_type: "CE" or "PE"
    Returns theoretical price in rupees

  compute_greeks(S, K, T, sigma, option_type) → Greeks
    Returns Greeks dataclass: delta, gamma, theta, vega, rho
    theta returned as per-day value in rupees (per unit, not per lot)

  compute_iv(market_price, S, K, T, option_type) → float | None
    Newton-Raphson IV inversion
    Returns IV as decimal or None if no convergence

  compute_payoff_table(legs: list[StrategyLeg], spot_range: list[float],
                       scenario: ScenarioParams) → list[PayoffPoint]
    For each spot in spot_range:
      For each leg: compute theoretical price using B-S with scenario adjustments
      Net P&L = sum of all leg P&Ls - total entry charges + exit charges
    Returns list of PayoffPoint

  compute_breakevens(payoff_table: list[PayoffPoint]) → list[float]
    Finds zero-crossings in payoff table (where P&L crosses zero)
    Returns list of spot prices (in rupees) where net P&L = 0

  compute_portfolio_greeks(positions: list[Position]) → Greeks
    Weighted sum of all position Greeks (see GREEKS.md)
    Returns net portfolio Greeks
```

---

## margin_service.py

Approximate margin calculations (see PAPER_ENGINE.md for formulas).

```
class MarginService:
  compute(order: PaperOrderCreate, fill_price_paise: int) → int
    Returns margin required in paise
    For BUY: fill_price × quantity
    For SELL: strike_price × lot_size × lots × 0.18 (18% of notional)

  compute_release(position: Position, close_quantity: int) → int
    Returns how much margin to release on partial or full close
    Proportional: (close_quantity / position.quantity) × position.margin_blocked

  compute_portfolio_margin(positions: list[Position]) → int
    Total margin blocked across all open positions
    Should match sum of position.margin_blocked values in DB
```

---

## pnl_service.py

P&L tracking and history.

```
class PnLService:
  __init__(db: AsyncSession, cache: CacheService) → None

  compute_unrealized_pnl(position: Position, current_ltp_paise: int) → int
    (current_ltp - avg_entry_price) × quantity × direction_sign
    direction_sign: +1 for LONG, -1 for SHORT
    Returns paise (can be negative)

  compute_portfolio_unrealized_pnl(positions: list[Position], ltps: dict[str, int]) → int
    Sum of unrealized P&L across all open positions
    ltps: { security_id: ltp_in_paise }

  get_daily_realized_pnl(user_id: UUID, date: date) → int
    SUM of net_pnl from trades WHERE user_id AND date(exit_timestamp) = date

  get_pnl_history(user_id: UUID, days: int) → list[DailyPnL]
    Returns: [{ date, realized_pnl, end_of_day_unrealized_pnl, net_pnl }]
    Used for the P&L chart in dashboard and analytics pages

  get_analytics_summary(user_id: UUID) → AnalyticsSummary
    Computes:
      total_trades, win_rate, profit_factor,
      avg_pnl_per_trade, max_drawdown,
      pnl_by_strategy, pnl_by_hour
    Returns AnalyticsSummary dataclass

  get_max_drawdown(user_id: UUID) → dict
    Computes peak-to-trough drawdown from daily P&L history
    Returns: { amount_paise, start_date, end_date, peak_value, trough_value }
```

---

## notification_service.py

In-process notification dispatch — sends messages over WebSocket to the user's browser.

```
class NotificationService:
  __init__(ws_manager: WSConnectionManager) → None

  async send_trade_confirmation(user_id: UUID, order: PaperOrder) → None
    Sends WS message: { type: "ORDER_FILLED", order_id, symbol, fill_price, pnl }

  async send_sl_triggered(user_id: UUID, position: Position, trade: Trade) → None
    Sends WS message: { type: "SL_TRIGGERED", symbol, exit_price, pnl }

  async send_margin_alert(user_id: UUID, utilization_pct: float, level: str) → None
    level: "WARNING" (75%) or "CRITICAL" (90%)
    Sends WS message: { type: "MARGIN_ALERT", level, utilization_pct }

  async send_daily_limit_hit(user_id: UUID, daily_loss: int, limit: int) → None
    Sends WS message: { type: "DAILY_LIMIT_HIT", daily_loss, limit }
    Trading is halted after this message

  async send_expiry_warning(user_id: UUID, positions: list[Position]) → None
    Sends WS message: { type: "EXPIRY_WARNING", count, symbols, expiry_at }

  async send_mtm_update(user_id: UUID, daily_pnl: int, total_pnl: int) → None
    Sends WS message: { type: "MTM_UPDATE", daily_pnl, total_pnl }
    Called on every position-affecting WS tick
```

---

## Scheduler Jobs (APScheduler config in `backend/src/config/scheduler.py`)

```
Job 1: download_instruments
  Trigger: cron, 8:45 AM IST, Monday–Friday, not holidays
  Function: calls scripts/download_instruments.py logic
  Timeout: 60 seconds

Job 2: check_limit_orders
  Trigger: interval, every 5 seconds
  Function: paper_engine.check_limit_orders(current_ticks)
  Active: only during market hours (9:15–15:30 IST, non-holiday)
  Timeout: 4 seconds (must complete before next run)

Job 3: expire_positions
  Trigger: cron, 15:30 IST on Thursdays (weekly expiry)
           and last Thursday of month (monthly expiry)
  Function: paper_engine.expire_positions(today)
  Timeout: 120 seconds

Job 4: daily_reset
  Trigger: cron, 9:14 AM IST, Monday–Friday, not holidays
  Function: reset user.trading_halted = False for all users
            snapshot day_start_cash

Job 5: snapshot_eod_pnl
  Trigger: cron, 15:35 PM IST, Monday–Friday, not holidays
  Function: store EOD unrealized P&L for each user (for P&L history chart)
```
