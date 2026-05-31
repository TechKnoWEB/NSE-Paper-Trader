-- NSE Paper Trader — Supabase PostgreSQL Schema
-- Monetary values in paise (BIGINT) — divide by 100 for ₹ display.
-- Idempotent: safe to run multiple times.

-- ==========================================================================
-- 0. PRE-CLEANUP (for databases migrated from old schema)
-- Remove old schema tables that are no longer used.
-- ==========================================================================
DO $$ BEGIN DROP TABLE IF EXISTS public.accounts CASCADE; END $$;
DO $$ BEGIN DROP TABLE IF EXISTS public.user_subscriptions CASCADE; END $$;
DO $$ BEGIN DROP TABLE IF EXISTS public.portfolio_snapshots CASCADE; END $$;
DO $$ BEGIN DROP TABLE IF EXISTS public.watchlist_items CASCADE; END $$;

-- Remove old columns from users table that are no longer used.
DO $$ BEGIN ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users DROP COLUMN IF EXISTS google_id; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users DROP COLUMN IF EXISTS avatar_url; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ==========================================================================
-- 1. USERS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id TEXT UNIQUE,
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  name            TEXT,
  virtual_cash    BIGINT NOT NULL DEFAULT 200000,
  margin_used     BIGINT NOT NULL DEFAULT 0,
  total_realized_pnl BIGINT NOT NULL DEFAULT 0,
  subscription_tier      TEXT NOT NULL DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  last_login      TIMESTAMPTZ,
  preferences     JSONB NOT NULL DEFAULT '{}'::jsonb,
  trading_halted  BOOLEAN NOT NULL DEFAULT FALSE,
  day_start_cash  BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns if missing (idempotent).
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS supabase_user_id TEXT UNIQUE; EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS virtual_cash BIGINT NOT NULL DEFAULT 200000; EXCEPTION WHEN duplicate_column THEN NULL; WHEN not_null_violation THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS margin_used BIGINT NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_realized_pnl BIGINT NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trading_halted BOOLEAN NOT NULL DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD COLUMN IF NOT EXISTS day_start_cash BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Set defaults on existing columns (only if they already exist and are nullable).
DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN virtual_cash SET DEFAULT 200000; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN subscription_tier SET DEFAULT 'free'; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- CHECK constraints.
DO $$ BEGIN ALTER TABLE public.users ADD CONSTRAINT chk_users_subscription_tier CHECK (subscription_tier IN ('free','basic','pro','elite')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users (supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- ==========================================================================
-- 2. PAPER ORDERS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.paper_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  security_id     TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  underlying      TEXT NOT NULL,
  strike_price    INTEGER NOT NULL,
  option_type     TEXT NOT NULL CHECK (option_type IN ('CE','PE')),
  expiry_date     DATE NOT NULL,
  exchange_segment TEXT NOT NULL,
  lot_size        INTEGER NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('BUY','SELL')),
  order_type      TEXT NOT NULL CHECK (order_type IN ('MARKET','LIMIT','SL_MARKET','SL_LIMIT')),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  limit_price     BIGINT,
  trigger_price   BIGINT,
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','FILLED','CANCELLED','REJECTED')),
  fill_price      BIGINT,
  fill_timestamp  TIMESTAMPTZ,
  brokerage       BIGINT NOT NULL DEFAULT 0,
  stt             BIGINT NOT NULL DEFAULT 0,
  exchange_charges BIGINT NOT NULL DEFAULT 0,
  gst             BIGINT NOT NULL DEFAULT 0,
  stamp_duty      BIGINT NOT NULL DEFAULT 0,
  sebi_fee        BIGINT NOT NULL DEFAULT 0,
  total_charges   BIGINT NOT NULL DEFAULT 0,
  margin_blocked  BIGINT NOT NULL DEFAULT 0,
  notes           TEXT,
  strategy_tag    TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns for existing table.
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS security_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS symbol TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS underlying TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS strike_price INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS option_type TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS expiry_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS exchange_segment TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS lot_size INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS action TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS order_type TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS quantity INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS limit_price BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS trigger_price BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS fill_price BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS fill_timestamp TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS brokerage BIGINT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS stt BIGINT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS exchange_charges BIGINT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS gst BIGINT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS stamp_duty BIGINT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS sebi_fee BIGINT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS total_charges BIGINT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS margin_blocked BIGINT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS strategy_tag TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- CHECK and FK constraints for existing tables.
DO $$ BEGIN ALTER TABLE public.paper_orders ADD CONSTRAINT chk_orders_option_type CHECK (option_type IN ('CE','PE')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD CONSTRAINT chk_orders_action CHECK (action IN ('BUY','SELL')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD CONSTRAINT chk_orders_order_type CHECK (order_type IN ('MARKET','LIMIT','SL_MARKET','SL_LIMIT')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD CONSTRAINT chk_orders_status CHECK (status IN ('PENDING','FILLED','CANCELLED','REJECTED')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paper_orders ADD CONSTRAINT chk_orders_quantity CHECK (quantity > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.paper_orders (user_id, status);

-- ==========================================================================
-- 3. POSITIONS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  security_id     TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  underlying      TEXT NOT NULL,
  strike_price    INTEGER NOT NULL,
  option_type     TEXT NOT NULL CHECK (option_type IN ('CE','PE')),
  expiry_date     DATE NOT NULL,
  exchange_segment TEXT NOT NULL,
  lot_size        INTEGER NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  avg_entry_price BIGINT NOT NULL,
  margin_blocked  BIGINT NOT NULL,
  greeks          JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_ltp        BIGINT,
  last_ltp_at     TIMESTAMPTZ,
  realized_pnl    BIGINT,
  close_price     BIGINT,
  closed_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  stop_loss_pct   REAL,
  strategy_tag    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, security_id, direction, deleted_at)
);

-- Add columns for existing table.
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS security_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS symbol TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS underlying TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS strike_price INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS option_type TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS expiry_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS exchange_segment TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS lot_size INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS direction TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS quantity INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS avg_entry_price BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS margin_blocked BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS greeks JSONB DEFAULT '{}'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS last_ltp BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS last_ltp_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS realized_pnl BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS close_price BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS stop_loss_pct REAL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS strategy_tag TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Constraints for existing tables.
DO $$ BEGIN ALTER TABLE public.positions ADD CONSTRAINT chk_positions_option_type CHECK (option_type IN ('CE','PE')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD CONSTRAINT chk_positions_direction CHECK (direction IN ('LONG','SHORT')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD CONSTRAINT chk_positions_quantity CHECK (quantity > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.positions ADD CONSTRAINT uq_positions_user_sec_dir UNIQUE (user_id, security_id, direction, deleted_at); EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_positions_user ON public.positions (user_id);

-- ==========================================================================
-- 4. TRADES
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position_id     UUID REFERENCES public.positions(id) ON DELETE SET NULL,
  security_id     TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  underlying      TEXT NOT NULL,
  strike_price    INTEGER NOT NULL,
  option_type     TEXT NOT NULL CHECK (option_type IN ('CE','PE')),
  expiry_date     DATE NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  entry_price     BIGINT NOT NULL,
  exit_price      BIGINT NOT NULL,
  gross_pnl       BIGINT NOT NULL,
  total_charges   BIGINT NOT NULL,
  net_pnl         BIGINT NOT NULL,
  entry_greeks    JSONB NOT NULL DEFAULT '{}'::jsonb,
  exit_greeks     JSONB NOT NULL DEFAULT '{}'::jsonb,
  entry_iv        NUMERIC(8,4),
  exit_iv         NUMERIC(8,4),
  entry_spot      BIGINT,
  exit_spot       BIGINT,
  entry_timestamp TIMESTAMPTZ NOT NULL,
  exit_timestamp  TIMESTAMPTZ NOT NULL,
  strategy_tag    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns for existing table.
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS security_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS symbol TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS underlying TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS strike_price INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS option_type TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS expiry_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS direction TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS quantity INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_price BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_price BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS gross_pnl BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS total_charges BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS net_pnl BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_greeks JSONB DEFAULT '{}'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_greeks JSONB DEFAULT '{}'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_iv NUMERIC(8,4); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_iv NUMERIC(8,4); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_spot BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_spot BIGINT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_timestamp TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_timestamp TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS strategy_tag TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Constraints for existing tables.
DO $$ BEGIN ALTER TABLE public.trades ADD CONSTRAINT chk_trades_option_type CHECK (option_type IN ('CE','PE')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD CONSTRAINT chk_trades_direction CHECK (direction IN ('LONG','SHORT')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trades ADD CONSTRAINT chk_trades_quantity CHECK (quantity > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_trades_user_date ON public.trades (user_id, exit_timestamp DESC);

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY user_isolation ON public.users
    FOR ALL USING (supabase_user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY order_isolation ON public.paper_orders
    FOR ALL USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY position_isolation ON public.positions
    FOR ALL USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY trade_isolation ON public.trades
    FOR ALL USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==========================================================================
-- TRIGGERS
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_paper_orders_updated_at BEFORE UPDATE ON public.paper_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_positions_updated_at BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_trades_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
