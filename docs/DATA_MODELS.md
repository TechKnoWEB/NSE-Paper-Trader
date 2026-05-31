# DATA_MODELS.md

> All database schemas and TypeScript type definitions for the project.
> The database is PostgreSQL. SQLAlchemy 2.0 ORM models live in `backend/src/models/`.
> TypeScript types live in `frontend/src/types/`.

---

## Database Tables

### users
```sql
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dhan_client_id   VARCHAR(50) UNIQUE NOT NULL,
  display_name     VARCHAR(100),
  virtual_cash     BIGINT NOT NULL DEFAULT 100000000,  -- ₹10L in paise
  margin_used      BIGINT NOT NULL DEFAULT 0,           -- in paise
  total_realized_pnl BIGINT NOT NULL DEFAULT 0,        -- in paise (can be negative)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login       TIMESTAMPTZ,
  preferences      JSONB DEFAULT '{}'
  -- preferences keys: starting_capital, slippage_model, brokerage_model
);

-- virtual_cash is reduced by realized losses and charges on close
-- virtual_cash is increased by realized profits on close
-- margin_used is added on open, released on close
-- virtual_cash - margin_used = available cash for new positions
```

### paper_orders
```sql
CREATE TABLE paper_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),

  -- Instrument identification
  security_id      VARCHAR(20) NOT NULL,    -- Dhan security_id
  symbol           VARCHAR(50) NOT NULL,    -- e.g. "NIFTY-24500-CE-25JAN24"
  underlying       VARCHAR(20) NOT NULL,    -- "NIFTY", "BANKNIFTY", etc.
  strike_price     INTEGER NOT NULL,        -- in rupees (not paise)
  option_type      CHAR(2) NOT NULL,        -- "CE" or "PE"
  expiry_date      DATE NOT NULL,
  exchange_segment VARCHAR(20) NOT NULL,    -- "NSE_FNO"
  lot_size         INTEGER NOT NULL,        -- e.g. 75 for NIFTY

  -- Order details
  action           VARCHAR(4) NOT NULL,     -- "BUY" or "SELL"
  order_type       VARCHAR(10) NOT NULL,    -- "MARKET" or "LIMIT"
  quantity         INTEGER NOT NULL,        -- total units (lots × lot_size)
  limit_price      BIGINT,                  -- in paise; NULL for MARKET orders
  trigger_price    BIGINT,                  -- in paise; for SL orders

  -- Fill details (populated after fill)
  status           VARCHAR(15) NOT NULL,    -- PENDING, FILLED, CANCELLED, REJECTED
  fill_price       BIGINT,                  -- actual execution price in paise
  fill_timestamp   TIMESTAMPTZ,

  -- Charges breakdown (in paise)
  brokerage        BIGINT NOT NULL DEFAULT 0,
  stt              BIGINT NOT NULL DEFAULT 0,
  exchange_charges BIGINT NOT NULL DEFAULT 0,
  gst              BIGINT NOT NULL DEFAULT 0,
  stamp_duty       BIGINT NOT NULL DEFAULT 0,
  sebi_fee         BIGINT NOT NULL DEFAULT 0,
  total_charges    BIGINT NOT NULL DEFAULT 0,

  -- Margin details
  margin_blocked   BIGINT NOT NULL DEFAULT 0,  -- in paise

  -- Metadata
  notes            TEXT,
  strategy_tag     VARCHAR(50),             -- "STRADDLE", "IRON_CONDOR", etc.
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ              -- soft delete

  -- Indexes
  -- CREATE INDEX idx_paper_orders_user_status ON paper_orders(user_id, status);
  -- CREATE INDEX idx_paper_orders_created ON paper_orders(user_id, created_at DESC);
);
```

### positions
```sql
CREATE TABLE positions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),

  -- Instrument identification (same as paper_orders)
  security_id      VARCHAR(20) NOT NULL,
  symbol           VARCHAR(50) NOT NULL,
  underlying       VARCHAR(20) NOT NULL,
  strike_price     INTEGER NOT NULL,
  option_type      CHAR(2) NOT NULL,
  expiry_date      DATE NOT NULL,
  exchange_segment VARCHAR(20) NOT NULL,
  lot_size         INTEGER NOT NULL,

  -- Position state
  direction        VARCHAR(5) NOT NULL,     -- "LONG" or "SHORT"
  quantity         INTEGER NOT NULL,        -- positive; direction indicates long/short
  avg_entry_price  BIGINT NOT NULL,         -- in paise (weighted average of fills)
  margin_blocked   BIGINT NOT NULL,         -- total margin for this position in paise

  -- Greeks snapshot (updated on each option chain refresh)
  greeks           JSONB DEFAULT '{}',
  -- { "delta": 0.45, "gamma": 0.002, "theta": -12.5, "vega": 45.2, "rho": 0.8 }

  -- Live tracking
  last_ltp         BIGINT,                  -- in paise; updated by WS feed
  last_ltp_at      TIMESTAMPTZ,

  -- Metadata
  strategy_tag     VARCHAR(50),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A user can have only one open position per security_id per direction
  UNIQUE (user_id, security_id, direction)
  -- (partial close creates a trade record; full close deletes the position)

  -- Indexes
  -- CREATE INDEX idx_positions_user ON positions(user_id);
  -- CREATE INDEX idx_positions_expiry ON positions(expiry_date);
);
```

### trades
```sql
CREATE TABLE trades (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  position_id      UUID REFERENCES positions(id),  -- NULL after position deleted

  -- Instrument (denormalized for history; position may be deleted)
  security_id      VARCHAR(20) NOT NULL,
  symbol           VARCHAR(50) NOT NULL,
  underlying       VARCHAR(20) NOT NULL,
  strike_price     INTEGER NOT NULL,
  option_type      CHAR(2) NOT NULL,
  expiry_date      DATE NOT NULL,

  -- Trade details
  direction        VARCHAR(5) NOT NULL,     -- "LONG" or "SHORT" (of the closed position)
  quantity         INTEGER NOT NULL,        -- units closed in this trade
  entry_price      BIGINT NOT NULL,         -- avg entry price in paise
  exit_price       BIGINT NOT NULL,         -- in paise

  -- P&L in paise
  gross_pnl        BIGINT NOT NULL,         -- (exit - entry) × qty × direction_sign
  total_charges    BIGINT NOT NULL,         -- all charges for this close
  net_pnl          BIGINT NOT NULL,         -- gross_pnl - total_charges

  -- Greeks at entry and exit (for analytics)
  entry_greeks     JSONB DEFAULT '{}',
  exit_greeks      JSONB DEFAULT '{}',
  entry_iv         NUMERIC(8,4),
  exit_iv          NUMERIC(8,4),
  entry_spot       BIGINT,                  -- underlying spot at entry in paise
  exit_spot        BIGINT,                  -- underlying spot at exit in paise

  -- Metadata
  entry_timestamp  TIMESTAMPTZ NOT NULL,
  exit_timestamp   TIMESTAMPTZ NOT NULL,
  strategy_tag     VARCHAR(50),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()

  -- Indexes
  -- CREATE INDEX idx_trades_user_date ON trades(user_id, exit_timestamp DESC);
  -- CREATE INDEX idx_trades_strategy ON trades(user_id, strategy_tag);
);
```

---

## TypeScript Types

### Paper Order Types (`frontend/src/types/paper.ts`)
```typescript
type OrderAction = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT" | "SL_MARKET" | "SL_LIMIT";
type OrderStatus = "PENDING" | "FILLED" | "CANCELLED" | "REJECTED";
type OptionType = "CE" | "PE";
type PositionDirection = "LONG" | "SHORT";

interface PaperOrderCreate {
  security_id: string;
  symbol: string;
  underlying: string;
  strike_price: number;        // rupees
  option_type: OptionType;
  expiry_date: string;         // YYYY-MM-DD
  exchange_segment: string;
  action: OrderAction;
  order_type: OrderType;
  quantity: number;            // must be multiple of lot_size
  limit_price?: number;        // paise; required for LIMIT orders
  trigger_price?: number;      // paise; for SL orders
  strategy_tag?: string;
  notes?: string;
}

interface PaperOrder extends PaperOrderCreate {
  id: string;
  user_id: string;
  lot_size: number;
  status: OrderStatus;
  fill_price?: number;         // paise
  fill_timestamp?: string;     // ISO datetime
  charges: ChargesBreakdown;
  margin_blocked: number;      // paise
  created_at: string;
}

interface ChargesBreakdown {
  brokerage: number;           // paise
  stt: number;
  exchange_charges: number;
  gst: number;
  stamp_duty: number;
  sebi_fee: number;
  total: number;
}
```

### Position Types
```typescript
interface Greeks {
  delta: number;    // 4 decimal places
  gamma: number;    // 4 decimal places
  theta: number;    // per day in rupees per unit
  vega: number;     // per 1% IV in rupees per unit
  rho: number;      // per 1% rate in rupees per unit
}

interface Position {
  id: string;
  user_id: string;
  security_id: string;
  symbol: string;
  underlying: string;
  strike_price: number;        // rupees
  option_type: OptionType;
  expiry_date: string;
  exchange_segment: string;
  lot_size: number;
  direction: PositionDirection;
  quantity: number;            // total units
  avg_entry_price: number;     // paise
  margin_blocked: number;      // paise
  greeks: Greeks;
  last_ltp: number;            // paise; updated live
  unrealized_pnl: number;      // paise; computed: (ltp - entry) × qty × sign
  strategy_tag?: string;
}
```

### Option Chain Types (`frontend/src/types/options.ts`)
```typescript
interface OptionContract {
  security_id: string;
  ltp: number;                 // paise
  oi: number;                  // open interest in contracts
  oi_change: number;           // OI change from previous day
  volume: number;
  iv: number;                  // decimal: 0.18 = 18%
  bid: number;                 // paise
  ask: number;                 // paise
  greeks: Greeks;
}

interface OptionStrike {
  strike_price: number;        // rupees
  is_atm: boolean;
  call: OptionContract;
  put: OptionContract;
}

interface OptionChain {
  symbol: string;
  expiry: string;
  spot_price: number;          // paise
  india_vix: number;
  strikes: OptionStrike[];
  last_updated: string;        // ISO datetime
  cache_age_seconds: number;   // how old is the cached data
}
```

### Strategy Types (`frontend/src/types/strategy.ts`)
```typescript
type StrategyName =
  | "LONG_CALL" | "LONG_PUT"
  | "BULL_CALL_SPREAD" | "BEAR_PUT_SPREAD"
  | "LONG_STRADDLE" | "SHORT_STRADDLE"
  | "LONG_STRANGLE" | "SHORT_STRANGLE"
  | "IRON_CONDOR" | "IRON_BUTTERFLY"
  | "COVERED_CALL" | "PROTECTIVE_PUT"
  | "CUSTOM";

interface StrategyLeg {
  id: string;
  action: OrderAction;
  option_type: OptionType;
  strike_price: number;        // rupees
  expiry_date: string;
  quantity: number;            // lots
  security_id?: string;        // populated after strike selection
  ltp?: number;                // paise; current market price for this leg
  greeks?: Greeks;
}

interface ScenarioParams {
  spot_delta_pct: number;      // % change in spot: -15 to +15
  iv_shift_pct: number;        // % point change in IV: -10 to +10
  days_forward: number;        // days to advance: 0 to expiry days
}

interface PayoffPoint {
  spot_price: number;          // rupees
  pnl: number;                 // paise
}

interface StrategyAnalysis {
  name: StrategyName;
  legs: StrategyLeg[];
  max_profit: number;          // paise; null if unlimited
  max_loss: number;            // paise; null if unlimited
  breakevens: number[];        // spot prices in rupees
  payoff_table: PayoffPoint[];
  net_premium: number;         // paise; + if credit, - if debit
  net_greeks: Greeks;
  margin_required: number;     // paise (approximate)
}
```

---

## Pydantic Schemas (Backend API contracts)

### `backend/src/api/paper_orders.py` — Request/Response Pydantic models

```
PaperOrderCreate → validates incoming POST /paper/orders
  - quantity must be a positive multiple of lot_size
  - limit_price required if order_type == "LIMIT"
  - expiry_date must be in the future
  - security_id must exist in instruments config

PaperOrderResponse → returned from POST /paper/orders
  - includes fill_price, charges, margin_blocked, status

PaperOrderListResponse → returned from GET /paper/orders
  - paginated: { items: List[PaperOrderResponse], total, page, limit }
```

### `backend/src/api/positions.py`

```
PositionResponse
  - includes unrealized_pnl (computed, not stored)
  - includes greeks from last option chain snapshot
  - includes lots_count = quantity / lot_size (for display)

PositionCloseRequest
  - quantity: int (must be ≤ position.quantity and multiple of lot_size)
```

---

## Redis Key Naming Convention

```
option_chain:{symbol}:{YYYY-MM-DD}           → Full option chain JSON; TTL 30s/1hr
quote:{security_id}                          → Single instrument quote; TTL 5s
historical:{security_id}:{interval}:{from}:{to} → OHLC candles; TTL 1hr
expiry_list:{symbol}                         → List of expiry dates; TTL 6hr
instruments_master                           → Full instrument CSV parsed; TTL 24hr
ws_subscriptions:{user_id}                   → Set of security_ids; TTL 24hr
session:{user_id}                            → JWT blacklist (for logout); TTL = token expiry
```
