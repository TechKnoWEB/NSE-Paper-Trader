# PAPER_ENGINE.md

> Complete rules for the virtual order execution engine.
> `backend/src/services/paper_engine.py` must implement all rules here exactly.

---

## The Prime Rule

**No real order is ever placed.** The paper engine simulates the *outcome* of a real
order using live Dhan price data. It lives entirely in our database.

---

## Order Lifecycle

```
CREATED (in memory)
    │
    ▼
VALIDATING → reject → REJECTED (stored with rejection reason)
    │
    ▼
PRICING (fetch LTP from cache/Dhan + apply slippage)
    │
    ▼
MARGIN CHECK → fail → REJECTED ("Insufficient margin: need ₹X, have ₹Y")
    │
    ▼
FILLED (for MARKET orders — immediate)
    or
PENDING (for LIMIT orders — waits for price to cross limit)
    │ (limit order filled when LTP crosses limit on next WS tick)
    ▼
FILLED → position created/updated, margin blocked, charges deducted
```

---

## Validation Rules (in this order)

### V1 — Market Hours
```
if not ist_clock.is_market_open():
  reject with: "Market is closed. Trading is available 9:15 AM to 3:30 PM IST on weekdays."
  exception: Allow limit order placement even when market closed (pre-placement),
             but they will never fill until market opens
```

### V2 — Instrument Validity
```
instrument = instruments_config.lookup(security_id)
if not instrument:
  reject with: "Instrument not found. security_id may be invalid or expired."

if instrument.expiry_date < today:
  reject with: "This contract has already expired."
```

### V3 — Lot Size
```
if order.quantity <= 0:
  reject with: "Quantity must be greater than zero."

if order.quantity % instrument.lot_size != 0:
  reject with: f"Quantity {order.quantity} is not a valid lot multiple. Lot size is {instrument.lot_size}."
```

### V4 — Limit Price (for LIMIT orders)
```
if order.order_type == "LIMIT" and order.limit_price is None:
  reject with: "Limit price is required for LIMIT orders."

if order.order_type == "LIMIT" and order.limit_price <= 0:
  reject with: "Limit price must be positive."
```

### V5 — Self-Offsetting Position Check
```
existing_opposite = positions.find(user_id, security_id, opposite_direction)
if existing_opposite and order.quantity > existing_opposite.quantity:
  # User is trying to close more than they hold — treat as close + open new position
  # Automatically split: close existing, then open net quantity in new direction
  # Log this split in the order notes
```

---

## Price Discovery (Fill Price Calculation)

### For MARKET Orders

```
1. Try Redis: ltp = cache.get_quote(security_id)
2. If cache miss or >10 seconds old: call Dhan quote API, update cache
3. Apply slippage (see slippage model below)
4. fill_price = ltp ± slippage
```

### For LIMIT Orders

```
fill_price = order.limit_price
Execute only when: ltp ≤ limit_price (for BUY) or ltp ≥ limit_price (for SELL)
Check condition on every incoming WS tick for pending orders
If condition met: fill immediately at limit_price (no slippage for limit orders)
If not met by expiry_date: auto-cancel at 3:30 PM on expiry day
```

---

## Slippage Model

Purpose: simulate the real-world cost of market impact.
Slippage is always adverse — buyers pay more, sellers receive less.

```
Classify the option:
  ATM: |ltp - strike| / ltp < 0.05       (within 5% of strike)
  OTM: ltp < 30 (rupees)                  (low premium = far OTM)
  ITM: ltp > strike × 0.05               (deep ITM)

Slippage amount (in paise):
  BUY  ATM (NIFTY/BANKNIFTY): +50 to +100 paise  (₹0.50 to ₹1.00 added)
  SELL ATM (NIFTY/BANKNIFTY): -50 to -100 paise  (₹0.50 to ₹1.00 deducted)
  BUY  OTM: +100 to +300 paise
  SELL OTM: -100 to -300 paise
  BUY  Stock options: +200 to +500 paise
  SELL Stock options: -200 to -500 paise

Randomize within the range using: random.uniform(low, high)
(This makes paper trading feel more realistic, not perfectly predictable)

fill_price = ltp + slippage  (slippage is negative for sell, positive for buy)
Minimum fill_price: 1 paise (options cannot have negative price)
```

---

## Margin Calculation (Approximate SPAN)

### For Option Buyers (LONG positions)
```
margin_required = fill_price × quantity
# Buyers only risk the premium paid — no additional SPAN
# Example: Buy 1 lot NIFTY 24500 CE at ₹246 (lot size 75)
# margin_required = 24600 paise × 75 = ₹18,450
```

### For Option Sellers (SHORT positions)
```
notional_value = strike_price × lot_size × (quantity / lot_size)
span_margin = notional_value × 0.15
exposure_margin = notional_value × 0.03
margin_required = span_margin + exposure_margin
# = notional_value × 0.18

# Example: Sell 1 lot NIFTY 24500 CE (lot size 75)
# notional_value = 24500 × 75 = ₹18,37,500
# margin_required = 18,37,500 × 0.18 = ₹3,30,750
```

### Margin Utilization Check
```
available_margin = user.virtual_cash - user.margin_used
if margin_required > available_margin:
  reject with: f"Insufficient margin. Required: ₹{margin_required/100:,.2f}, Available: ₹{available_margin/100:,.2f}"
```

---

## Position Management

### Opening a New Position
```
Check if a position already exists for (user_id, security_id, direction):
  → No existing: INSERT new position row
  → Existing same direction: UPDATE avg_entry_price (weighted average), add quantity
     new_avg = (old_qty × old_avg + new_qty × fill_price) / (old_qty + new_qty)
  → Existing opposite direction: this is a close (handled by close_position)
```

### Closing a Position (full or partial)
```
close_quantity must be ≤ position.quantity and multiple of lot_size

Fetch current LTP (same as order price discovery, no slippage for closing)
  (Slippage is built into the exit fill via the closing paper order)

realized_pnl = (exit_price - avg_entry_price) × close_quantity × direction_sign
  direction_sign: +1 for LONG (profit from price rise), -1 for SHORT (profit from fall)

charges = charges.compute(exit_price, close_quantity, "SELL")

net_pnl = realized_pnl - total_charges

DB transaction (atomic):
  1. If full close: DELETE position record
     If partial close: UPDATE position SET quantity -= close_quantity
                       Proportionally release margin
  2. INSERT trade record with all details
  3. UPDATE user SET:
     virtual_cash += net_pnl  (adds if profit, subtracts if loss)
     margin_used -= released_margin
```

---

## Automatic Expiry Handling

Run daily at 3:30 PM IST via APScheduler (see `backend/src/config/scheduler.py`):

```
1. Find all positions where expiry_date == today
2. For each expiring position:
   a. Fetch final settlement price (LTP at 3:30 PM from Dhan quote)
   b. Determine if option expires worthless (ltp ≤ 0.05) or ITM
   c. For buyers:
      - If worthless: close at ₹0.05 (minimum) — full loss
      - If ITM: close at intrinsic value (spot - strike for CE; strike - spot for PE)
   d. For sellers:
      - If worthless: full profit (premium received kept)
      - If ITM: loss = intrinsic value × quantity
   e. Write trade record, update virtual_cash and margin_used
   f. Log: "Position {symbol} expired. Settlement: ₹{price}. P&L: ₹{pnl}"

3. Cancel all pending limit orders for today's expiry
```

---

## Limit Order Monitoring

APScheduler runs every 5 seconds during market hours (9:15 AM to 3:30 PM):

```
1. Load all PENDING limit orders from DB
2. For each pending order:
   a. Fetch current LTP from Redis cache
   b. Check fill condition:
      BUY LIMIT: ltp ≤ order.limit_price → fill at limit_price
      SELL LIMIT: ltp ≥ order.limit_price → fill at limit_price
   c. If filled: execute paper_engine.fill_limit_order(order, limit_price)
3. At 3:30 PM: cancel all remaining PENDING orders → status = CANCELLED
```

---

## Charges Calculation Sequence

```
premium_value = fill_price × quantity   (in paise)

STT:
  For BUY options:  stt = 0  (STT not charged on buy side for options)
  For SELL options: stt = ceil(premium_value × 0.000625)

Exchange transaction charge:
  exc_charge = ceil(premium_value × 0.00053)   (0.053% for NFO)

SEBI turnover fee:
  sebi_fee = ceil(premium_value × 0.0000001)   (₹10 per crore)

Brokerage:
  brokerage = 2000  (₹20 per order in paise)

GST:
  taxable = brokerage + exc_charge + sebi_fee
  gst = ceil(taxable × 0.18)

Stamp duty:
  For BUY:  stamp = ceil(premium_value × 0.00003)  (0.003%)
  For SELL: stamp = 0

total_charges = brokerage + stt + exc_charge + gst + stamp + sebi_fee
```

All values in paise (integer). Use `ceil()` to round up (conservative/realistic).

---

## Audit Log

Every state-changing operation must be logged:
```
Format: { timestamp, user_id, action, details, result }
Actions: ORDER_PLACED, ORDER_FILLED, ORDER_REJECTED, POSITION_OPENED,
         POSITION_CLOSED, POSITION_EXPIRED, MARGIN_BLOCKED, MARGIN_RELEASED

Store in: application logs (not database — keep DB lean)
Retention: 30 days
```
