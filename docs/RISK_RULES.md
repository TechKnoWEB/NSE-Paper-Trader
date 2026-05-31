# RISK_RULES.md

> All risk management rules for the paper trading system.
> These are enforced server-side in `backend/src/services/`.
> The frontend shows warnings; the backend enforces hard limits.

---

## Risk Rule Layers

```
Layer 1: Per-Order Validation     → runs before every paper order
Layer 2: Portfolio Limits         → runs after every order fill
Layer 3: Real-Time Monitoring     → runs on every WS tick
Layer 4: Daily Reset              → runs at market open (9:15 AM IST)
```

---

## Layer 1: Per-Order Risk Checks

All run inside `paper_engine.fill_paper_order()`, after margin check.

### R1-01 — Maximum Order Size
```
max_lots_per_order = 50   (configurable in user.preferences)

if order.quantity / lot_size > max_lots_per_order:
  reject: "Order exceeds maximum 50 lots per order. Place multiple smaller orders."
```

### R1-02 — Maximum Single Position Size
```
max_lots_per_position = 100   (configurable in user.preferences)

existing_lots = existing_position.quantity / lot_size if exists else 0
new_total_lots = existing_lots + order.quantity / lot_size

if new_total_lots > max_lots_per_position:
  reject: "Position would exceed maximum 100 lots. Reduce quantity."
```

### R1-03 — Margin Utilization Cap
```
max_margin_utilization = 0.80   (80% of virtual cash)
# This leaves 20% cash buffer — avoids being locked out completely

post_order_margin_used = user.margin_used + new_margin_required
if post_order_margin_used > user.virtual_cash × max_margin_utilization:
  reject: "This order would utilize >80% of your virtual capital. Consider reducing size."
  # This is a WARNING, not a hard reject (configurable: can be made soft)
```

### R1-04 — Expiry Proximity Warning
```
days_to_expiry = (order.expiry_date - today).days

if order.action == "SELL" and days_to_expiry <= 1:
  warn: "Caution: Selling options on expiry day carries extreme Gamma risk. Proceed with care."
  # Warning only — still allows the order
```

---

## Layer 2: Portfolio-Level Limits

Run after every fill, inside `paper_engine` after DB write.

### R2-01 — Daily Loss Limit
```
Check user.preferences.daily_loss_limit (default: 50000 paise = ₹500)
# This limit is relative to starting-of-day virtual_cash

daily_loss = day_start_cash - (user.virtual_cash + mtm_unrealized_pnl)

if daily_loss >= user.preferences.daily_loss_limit:
  SET user.trading_halted = True
  notify: "Daily loss limit reached. Trading is halted for today. Limit: ₹{limit}"
  # All new order placement returns 403 with: "Daily loss limit reached. Reset tomorrow."
  # Existing positions remain open (can still close them)
```

### R2-02 — Capital Preservation Floor
```
if user.virtual_cash + mtm_unrealized_pnl < 100000 paise (₹1,000):
  SET user.trading_halted = True
  notify: "Virtual capital critically low (< ₹1,000). Trading halted."
  # User can reset capital in /settings
```

### R2-03 — Concurrent Positions Limit
```
max_open_positions = 20   (configurable)

open_count = COUNT(positions WHERE user_id = user.id)
if open_count >= max_open_positions:
  reject: "Maximum 20 open positions reached. Close some positions before opening new ones."
```

### R2-04 — Same Expiry Concentration Warning
```
positions_expiring_today = COUNT(positions WHERE expiry_date = today AND user_id = ...)
if positions_expiring_today >= 3 AND today == expiry_day:
  warn: "You have {n} positions expiring today. High settlement risk."
  # Warning displayed on dashboard as a banner; not a trade blocker
```

---

## Layer 3: Real-Time Monitoring (On Every WS Tick)

Run inside `ws.py` when processing each incoming tick.

### R3-01 — Stop-Loss Trigger for Open Positions
```
# Users can set a stop-loss % when opening a position
# Stored in position.stop_loss_pct (nullable)

if position.stop_loss_pct is not None:
  entry_price = position.avg_entry_price
  current_ltp = tick.ltp
  pnl_pct = (current_ltp - entry_price) / entry_price × direction_sign × 100

  if pnl_pct <= -position.stop_loss_pct:
    # Auto-close the position at current market price
    paper_engine.close_position(position, position.quantity)
    notify: "Stop-loss triggered for {symbol}. Closed at ₹{exit_price}. P&L: ₹{pnl}"
```

### R3-02 — Margin Call Warning
```
margin_utilization = user.margin_used / user.virtual_cash

if margin_utilization >= 0.90:   (90% threshold)
  send WS message to user: { type: "MARGIN_ALERT", level: "CRITICAL", utilization: 0.90 }

elif margin_utilization >= 0.75:   (75% threshold)
  send WS message to user: { type: "MARGIN_ALERT", level: "WARNING", utilization: 0.75 }
```

### R3-03 — MTM Update and Daily P&L Tracking
```
On every tick for a security_id in the user's positions:
  new_unrealized_pnl = Σ position.unrealized_pnl across all positions
  daily_pnl = realized_pnl_today + new_unrealized_pnl

  Broadcast to user's WS client:
    { type: "MTM_UPDATE", daily_pnl, total_pnl, positions_updated: [security_id] }
```

### R3-04 — Expiry Day Warning Broadcast
```
At 9:15 AM on every Thursday (weekly expiry day):
  positions_expiring = find positions expiring today
  if any:
    send: { type: "EXPIRY_WARNING", count: n, symbols: [...], expiry_at: "15:30" }
```

---

## Layer 4: Daily Reset (9:14 AM IST via APScheduler)

Run every weekday (non-holiday) at 9:14 AM IST — 1 minute before market open.

```
For each user:
  1. Snapshot day_start_cash = user.virtual_cash + yesterday's unrealized P&L settlement
  2. Reset user.trading_halted = False (new day, fresh start)
  3. Reset daily realized P&L counter to 0
  4. Log: "New trading day started for user {id}. Starting capital: ₹{capital}"
```

---

## Risk Dashboard (Frontend `/analytics` page)

The frontend Risk section shows the user:

```
Current State:
  ├── Margin Utilization: [████████░░] 78% — WARNING zone (yellow)
  ├── Daily P&L: -₹1,240 (today)
  ├── Net Delta: +42.5 (directional bias — long NIFTY equivalent)
  ├── Net Theta: -₹380/day (time working against you)
  └── Days to nearest expiry: 3 days

Risk Limits:
  ├── Daily Loss Limit: ₹5,000 — used ₹1,240 (25%)
  ├── Max Positions: 20 — using 7
  └── Margin Cap (80%): ₹8,00,000 — used ₹6,24,000 (78%)

Positions Expiring Soon:
  ├── NIFTY 24500 CE — expires in 3 days
  └── BANKNIFTY 52000 PE — expires in 3 days
```

---

## Risk Preferences (User-Configurable in `/settings`)

```
daily_loss_limit:       integer (paise)  default: 500000 (₹5,000)
max_lots_per_order:     integer          default: 50
max_lots_per_position:  integer          default: 100
max_open_positions:     integer          default: 20
margin_cap_pct:         float (0-1)      default: 0.80
stop_loss_pct:          float            default: null (disabled)
auto_close_on_sl:       boolean          default: true
halt_on_daily_limit:    boolean          default: true
expiry_day_warnings:    boolean          default: true
```

All stored in `user.preferences` JSONB column.
