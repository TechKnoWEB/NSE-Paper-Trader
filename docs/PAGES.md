# PAGES.md — All Page Specifications

> Every page route in the app. Layout, components used, data fetched, and user interactions.
> The frontend agent reads this to build each `src/pages/*.tsx` file.

---

## /login — Login Page

### Layout
Full-screen centered card on dark background. No sidebar. No topbar.
App logo top center. Card width: 400px max.

### Content
- App name: "NSE Paper Trader" in large monospace
- Tagline: "Simulate NSE options trading. Zero risk."
- Section heading: "Connect Your Dhan Account"
- Two inputs:
  1. Client ID (text input, placeholder: "Your Dhan Client ID")
  2. Access Token (password input, toggle show/hide)
- A "How to get your API credentials" collapsible section explaining the developer.dhanhq.co steps
- "Connect & Start Trading" submit button
- Disclaimer text: "Paper trading only. No real orders are placed."

### Behavior
- On submit: POST /auth/login
- On success: redirect to /
- On failure: show error inline (e.g., "Invalid credentials. Check your Dhan access token.")
- If already logged in (valid JWT in cookie): auto-redirect to /

### No Data Fetching
Login page fetches nothing. All form submission.

---

## / — Dashboard Page

### Layout
Full app shell (sidebar + topbar). Main content area split into:
- Top row: 4 summary cards (full width)
- Middle row: Open Positions table (left 60%) + Market Status panel (right 40%)
- Bottom row: P&L chart (full width)

### Summary Cards (4 across top)
1. **MTM Card** — Today's MTM P&L with color and trend arrow
   - Value: `portfolioStore.dailyPnL` formatted as ₹
   - Sub-label: "Today's P&L"
   - Color: green if positive, red if negative

2. **Virtual Balance Card** — Available cash
   - Value: `virtual_cash - margin_used` formatted as ₹
   - Sub-label: "Available Margin"

3. **Open Positions Card** — Count of open positions
   - Value: `positions.length`
   - Sub-label: "Open Positions"
   - Click → navigates to /positions

4. **India VIX Card** — Current VIX with color coding
   - Value: `marketStore.indiaVix`
   - Color: green < 15, yellow 15–20, red > 20
   - Sub-label: "India VIX"

### Market Status Panel (right column)
- Shows: NIFTY spot price (live), BANK NIFTY spot (live), market open/closed status
- Shows: Time to market open (if pre-open) or time remaining (if open)
- Shows: Next expiry date and days remaining

### Open Positions Mini-Table
Compact version of positions table showing top 5 by unrealized P&L:
- Symbol | Entry ₹ | LTP ₹ | P&L ₹ | Θ/day
- "View All Positions" link to /positions

### P&L Chart
- Recharts AreaChart showing cumulative net P&L over the past 30 days
- X-axis: dates, Y-axis: P&L in ₹
- Green fill above zero, red fill below zero (use gradients)
- Data: GET /portfolio/pnl-history?days=30

### Data Fetched
- `GET /portfolio` → summary cards (refetch every 30s)
- `GET /positions?status=OPEN` → positions mini-table (live via WS)
- `GET /portfolio/pnl-history?days=30` → P&L chart (refetch every 5min)
- `GET /market-feed/quote?security_ids=13,25` → NIFTY + BANK NIFTY spot (refetch every 5s)

---

## /option-chain — Option Chain Page

### Layout
Full app shell. Top controls row. Full-width option chain table below.

### Top Controls Row
- Symbol selector: dropdown (NIFTY / BANKNIFTY / FINNIFTY / custom stock)
- Expiry selector: dropdown (populated from GET /option-chain/expirylist)
- "Refresh" button with last-updated timestamp
- India VIX badge
- Underlying spot price (large, live updating)

### Option Chain Table

Full-width table. Structure:

```
← CALL OPTIONS ──────────────────── STRIKE ────────── PUT OPTIONS →
OI   Vol   IV    Δ    Θ    LTP  │  Strike  │  LTP   Θ    Δ    IV   Vol   OI
```

- ATM strike row: yellow background highlight
- ITM call rows (strikes below spot for calls): subtle green tint
- ITM put rows (strikes above spot for puts): subtle red tint
- OTM rows: default dark background
- All numbers right-aligned, monospace font
- OI displayed in thousands (e.g., "1,234K")
- IV displayed as percentage (e.g., "14.32%")
- Greeks: Delta 4dp, Theta 2dp

### Interactivity
- Click any LTP cell → opens `OrderTicket` inline (slides in from right as drawer)
- Hover any row → shows tooltip with all 5 Greeks for that strike
- Click column header → sort by that column
- "ATM" button in header → scroll/jump to ATM strike row
- Strike filter: "Show ±10 strikes from ATM" toggle to reduce noise

### OrderTicket Drawer
Slides in from right when a strike LTP is clicked:
- Shows: Selected strike, CE/PE, current LTP
- Action: BUY / SELL toggle
- Order type: MARKET / LIMIT
- Quantity: lot selector (1 lot, 2 lots, ... up to 50)
- If LIMIT: limit price input (pre-filled with LTP)
- Shows: Estimated fill price with slippage
- Shows: Charges breakdown (STT, brokerage, GST, total)
- Shows: Margin required vs available (with warning if close to limit)
- "Confirm Order" button → calls usePaperOrder.placePaperOrder()
- On success: Toast + drawer closes + positions update
- On failure: inline error in drawer (drawer stays open)

### Data Fetched
- `GET /option-chain?symbol=NIFTY&expiry=<date>` → auto-refetch every 30s
- `GET /option-chain/expirylist?symbol=NIFTY` → populate expiry dropdown
- `GET /market-feed/quote?security_ids=13` → NIFTY spot for ATM calculation

---

## /positions — Positions Page

### Layout
Full app shell. Two tabs: "Open Positions" and "Trade History"

### Open Positions Tab

Full-width table with columns:
- Symbol (e.g., "NIFTY 24500 CE 25JAN")
- Direction (LONG green badge / SHORT red badge)
- Qty (lots × lot_size)
- Avg Entry ₹
- LTP ₹ (live, flashes on update)
- Unrealized P&L ₹ (green/red)
- P&L % (vs margin blocked)
- Δ (position delta)
- Θ/day (daily theta in ₹)
- Margin Blocked ₹
- Expiry (with "X days" indicator; red if ≤ 3 days)
- Actions: [Close] button

**Close Button behavior:**
- Opens a mini modal: "Close how many lots?" (default: all)
- Confirms: "Close 1 lot NIFTY 24500 CE at market price ~₹246?"
- On confirm: POST /positions/{id}/close
- On success: position removed from table (or quantity reduced), Toast shows realized P&L

**Portfolio Greeks Summary Bar** (above table):
```
Net Δ: +42.5    Net Γ: +0.023    Net Θ: −₹380/day    Net Ⅴ: +₹1,240/1%IV
```

### Trade History Tab
Table of closed trades (from `GET /positions?status=CLOSED`):
- Date | Symbol | Direction | Qty | Entry ₹ | Exit ₹ | Gross P&L | Charges | Net P&L | Strategy
- Sortable by date, P&L, symbol
- Color coded: net P&L green if positive, red if negative
- Export button: downloads CSV via `GET /positions/export`

### Data Fetched
- `GET /positions?status=OPEN` → open positions (live via WS + polling)
- `GET /positions?status=CLOSED&page=1&limit=50` → trade history
- `GET /portfolio` → net Greeks summary bar

---

## /orders — Order Book Page

### Layout
Full app shell. Two sections: Pending Orders + Order History

### Pending Orders Section
Table of PENDING limit orders:
- Time | Symbol | Action | Type | Qty | Limit Price | Current LTP | Distance to Trigger
- Distance: how far LTP is from limit (e.g., "₹12.50 away")
- [Cancel] button per row → DELETE /paper/orders/{id}
- Empty state: "No pending limit orders. Market orders fill instantly."

### Order History Section
All FILLED, CANCELLED, REJECTED orders (paginated):
- Time | Symbol | Action | Qty | Fill Price | Status badge | Charges | Notes
- Status badges: FILLED (green), CANCELLED (grey), REJECTED (red)
- Filter by: status, date range, symbol

### Data Fetched
- `GET /paper/orders?status=PENDING` → pending orders (refetch every 5s)
- `GET /paper/orders?status=FILLED,CANCELLED,REJECTED&page=1` → history

---

## /strategy — Strategy Builder Page

### Layout
Full app shell. Two-column layout:
- Left (40%): Leg builder panel
- Right (60%): Payoff chart + scenario controls

### Left Panel — Strategy Legs

**Template Selector** (top of left panel):
- Buttons: Long Call | Long Put | Straddle | Strangle | Iron Condor | Bull Spread | Bear Spread | Custom
- Clicking a template pre-fills the legs below

**Legs List:**
Each leg shows:
- Action: BUY / SELL toggle
- Option type: CE / PE toggle
- Expiry: date selector
- Strike: dropdown (populated from option chain, grouped by ITM/ATM/OTM)
- Qty: lot number input
- Current LTP (fetched from option chain data)
- Greeks for this leg (Delta, Theta)
- [Remove] button (X icon)

**[Add Leg]** button → appends a new blank leg row
Maximum 6 legs.

**Summary below legs:**
- Net Premium: debit (−) or credit (+) in ₹
- Net Delta, Net Theta, Net Vega
- Estimated Margin Required ₹

**[Paper Trade This Strategy]** button:
- Sends all legs as individual paper orders
- Shows confirmation: "Place 3 orders for Iron Condor strategy?"
- On confirm: calls usePaperOrder for each leg
- On all success: redirect to /positions with strategy tag filter

### Right Panel — Payoff Chart

**PayoffChart component:**
- X-axis: NIFTY spot price from -15% to +15% of current
- Y-axis: Net P&L in ₹
- Green shaded area above zero (profit zone)
- Red shaded area below zero (loss zone)
- Vertical line at current spot price (labeled "Current: 24,450")
- Dots at breakeven points (labeled "BE: 24,120" and "BE: 24,880")
- Horizontal dashed line at Max Profit (labeled "Max P: ₹8,400")
- Horizontal dashed line at Max Loss (labeled "Max L: −₹3,200")

**Scenario Controls** (below chart):
Three sliders:
1. Spot ±%: −15 → +15 (current spot line moves on chart in real-time)
2. IV change: −10% → +10% (chart recalculates with new IV)
3. Days forward: 0 → expiry days (shows effect of time decay)

**Scenario Summary** (below sliders):
```
At +5% spot, −2% IV, 3 days later:
  Estimated P&L: +₹4,200
  Delta at scenario: +0.23
```

### Data Fetched
- `GET /option-chain?symbol=NIFTY&expiry=<date>` → populate strike dropdowns + LTP
- `POST /strategy/payoff` (on leg change) → recalculate payoff table (debounced 300ms)

---

## /analytics — Analytics Page

### Layout
Full app shell. Tab navigation: Overview | By Strategy | By Time | Trade Log

### Overview Tab

**P&L Chart (top, full width)**
- Recharts AreaChart: cumulative net P&L over time
- Period selector: 7D / 30D / 90D / All Time
- Hover tooltip: date + day P&L + cumulative P&L

**4 Metric Cards (below chart):**
1. Total Trades Closed
2. Win Rate (% profitable trades)
3. Profit Factor (gross profit / gross loss)
4. Average P&L per Trade

**Max Drawdown Card:**
- Shows worst peak-to-trough drop in paper trading history
- "Max Drawdown: −₹12,400 (from ₹11,20,000 to ₹11,07,600 on 15 Jan)"

### By Strategy Tab
Bar chart: Average Net P&L per strategy type
- X-axis: STRADDLE, IRON_CONDOR, LONG_CALL, etc.
- Y-axis: Average P&L in ₹
- Table below: Strategy | Trades | Win Rate | Avg P&L | Best | Worst

### By Time Tab
**Two charts side by side:**
1. Heatmap: P&L by day of week × time of day (9:15–15:30 in 30-min buckets)
2. Bar chart: P&L by expiry type (Weekly vs Monthly)

**Insight box:**
Auto-generated text like: "You perform best on Tuesdays between 10:00–11:00 AM.
Your Straddle strategies have a 67% win rate. Avoid trading in the last 30 minutes —
your win rate drops to 38%."

### Trade Log Tab
Full paginated trade table:
- Every closed trade with all fields
- Filter: symbol, strategy, date range, P&L (profit/loss)
- Sort: any column
- Each row expandable: shows entry/exit Greeks, IV comparison
- [Add Note] button: add/edit text notes on any trade
- [Export CSV] button

### Data Fetched
- `GET /analytics/summary` → all metric cards
- `GET /analytics/pnl-history?days=<n>` → P&L chart
- `GET /analytics/by-strategy` → strategy breakdown
- `GET /analytics/by-time` → time heatmap
- `GET /positions?status=CLOSED&page=<n>` → trade log (paginated)

---

## /settings — Settings Page

### Layout
Full app shell. Left nav with sections. Right content area.

### Section 1 — Dhan API Credentials
- Client ID input (masked, show last 4 chars)
- Access Token input (password field, toggle show)
- [Test Connection] button → calls check_dhan_connection script logic
- Shows connection status: ✓ Connected (green) or ✗ Failed (red with reason)
- Link: "Get your API credentials at developer.dhanhq.co"
- Note: "Dhan access tokens expire daily. Update this each morning."

### Section 2 — Virtual Capital
- Current virtual balance display: "₹9,24,500"
- [Reset Capital] button → shows confirmation modal
  - "Reset to: ₹10,00,000 (default)" or custom amount input
  - "WARNING: This will close all open positions at current market price."
  - Requires typing "RESET" to confirm

### Section 3 — Risk Preferences
All settings from `RISK_RULES.md` user-configurable section:
- Daily loss limit (₹ input)
- Max lots per order (number input)
- Max lots per position (number input)
- Max open positions (number input)
- Margin cap % (slider: 50%–100%)
- Auto stop-loss % (toggle + % input when enabled)
- Halt trading on daily limit (toggle)
- Expiry day warnings (toggle)

### Section 4 — Display Preferences
- Default index: NIFTY / BANK NIFTY / FIN NIFTY
- Default expiry: Weekly (nearest) / Monthly
- Option chain strikes shown: ±5 / ±10 / ±20 from ATM
- P&L display: Percentage / Absolute ₹ / Both
- Theme: Dark (only option — light theme not supported)
- Numbers locale: Indian (₹1,00,000) / International ($100,000)

### Section 5 — About
- App version
- Backend API status
- Database connection status
- Redis connection status
- Last instruments data download timestamp
- [Re-download Instruments] button (useful after lot size changes)

---

## Error Pages

### 404 — Not Found
- Message: "This page doesn't exist."
- [Go to Dashboard] button

### 500 — Server Error
- Message: "Something went wrong. Our backend may be restarting."
- Shows last known market data if available
- [Retry] button

### Market Data Unavailable
- Inline banner (not full page): "Market data temporarily unavailable. Showing prices from [time] ago."
- Yellow/orange warning background
- Shown when Dhan API is unreachable and cache is >5 minutes old
