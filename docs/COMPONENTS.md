# COMPONENTS.md — Component Library Specification

> Every reusable component in `frontend/src/components/`.
> Specifies props, behavior, and visual rules for each component.
> No code — pure contract for the frontend agent.

---

## Design Tokens (from Tailwind CSS config)

```
Colors (extend in tailwind.config.ts):
  terminal-bg:       #0A0B0D    background of app
  terminal-surface:  #111318    cards, panels, table rows
  terminal-border:   #1E2028    dividers, input borders
  terminal-muted:    #5C6070    secondary text, placeholders
  terminal-text:     #E8EAF0    primary text
  profit:            #00C853    gains, call side, long
  loss:              #FF3D57    losses, put side, short
  atm:               #FFB300    ATM strike highlight
  accent:            #2979FF    interactive elements, focus rings
  warning:           #FF9800    caution states

Font families (add to @font-face or Google Fonts import):
  font-mono:   JetBrains Mono    → all prices, Greeks, numbers
  font-ui:     IBM Plex Sans     → all UI text, labels, headings
```

---

## Layout Components

### AppShell.tsx
Container for all authenticated pages.

Structure:
```
<div class="flex h-screen bg-terminal-bg overflow-hidden">
  <Sidebar />
  <div class="flex-1 flex flex-col overflow-hidden">
    <TopBar />
    <main class="flex-1 overflow-y-auto p-4">
      {children}
    </main>
  </div>
</div>
```

Props: `{ children: ReactNode }`

---

### Sidebar.tsx
Left navigation rail.

Props: none (reads route from React Router)

Layout:
- Width: 220px expanded, 64px collapsed (toggle persisted in localStorage)
- Top: App logo + name ("NSE Paper Trader")
- Nav items (icon + label):
  - 📊 Dashboard → /
  - 📈 Option Chain → /option-chain
  - 💼 Positions → /positions
  - 📋 Orders → /orders
  - 🔧 Strategy → /strategy
  - 📉 Analytics → /analytics
  - ⚙️ Settings → /settings
- Bottom: Market Status indicator (dot + text)
  - Green dot + "MARKET OPEN" during 9:15–15:30
  - Red dot + "MARKET CLOSED" otherwise
  - Yellow dot + "PRE-OPEN" at 9:00–9:15

Active route: accent blue left border + slightly lighter background on active nav item
Hover: subtle background highlight

---

### TopBar.tsx
Horizontal bar at top of main area.

Props: none (reads from stores)

Content (left to right):
- Page title (derived from current route)
- Spacer
- Global symbol search input (searches option contracts)
- Virtual Balance display: "₹9,24,500 | Margin: ₹75,500 used"
- Market Clock: "09:45:32 IST" (live, updates every second)
- Notification bell (for SL triggers, expiry warnings, margin alerts)
  - Badge count of unread alerts

---

### MobileNav.tsx
Bottom tab bar on screens < 768px.

5 tabs: Dashboard | Chain | Positions | Strategy | Settings
Active tab: accent blue icon + label

---

## Options Components

### OptionChainTable.tsx

Props:
```
{
  chain: OptionChain
  onStrikeSelect: (strike: OptionStrike, side: "CE" | "PE") => void
  highlightedStrike?: number
}
```

Behavior:
- Renders header row + one StrikeRow per strike
- Wraps in a virtualized scroll container (use `@tanstack/react-virtual` for 100+ strikes)
- On mount: auto-scroll to ATM row (find strike where `is_atm === true`)
- Sticky header row
- Sticky ATM strike indicator: floating "ATM ▲" / "ATM ▼" button when ATM is off-screen

---

### StrikeRow.tsx

Props:
```
{
  strike: OptionStrike
  spotPrice: number
  onSelect: (side: "CE" | "PE") => void
  isAtm: boolean
}
```

Layout (7 columns each side + 1 center):
```
[OI] [Vol] [IV%] [Δ] [Θ] [LTP ▲▼] │ [STRIKE] │ [LTP ▲▼] [Θ] [Δ] [IV%] [Vol] [OI]
```

Visual rules:
- `isAtm`: row background `#1A1A08` (dark yellow tint) + strike cell `#FFB300` text
- Call ITM (strike < spot): CE side background `rgba(0,200,83,0.05)` (faint green)
- Put ITM (strike > spot): PE side background `rgba(255,61,87,0.05)` (faint red)
- LTP cell: clickable (cursor pointer, hover: slightly brighter)
- LTP cell click → calls `onSelect("CE")` or `onSelect("PE")`
- PriceTag animation on LTP change (300ms flash)
- Memoized with React.memo — only re-renders when LTP or OI changes

---

### GreeksDisplay.tsx

Props:
```
{
  greeks: Greeks
  quantity?: number      // if provided, shows position-level Greeks
  lotSize?: number
  direction?: "LONG" | "SHORT"
  layout: "inline" | "card" | "tooltip"
}
```

Inline layout (for table cells): `Δ 0.45 | Γ 0.002 | Θ −12.5 | V 45.2`
Card layout (for strategy builder): vertical list with labels and values
Tooltip layout: compact grid shown in Tooltip component

---

### OrderTicket.tsx

Props:
```
{
  strike: OptionStrike
  side: "CE" | "PE"
  onClose: () => void
  onOrderPlaced: (order: PaperOrder) => void
}
```

Form fields (NO `<form>` tag — use div + onClick handlers):
- Action: BUY / SELL — large toggle buttons (green/red)
- Order Type: MARKET / LIMIT — tab toggle
- Quantity: `<select>` with lot options 1–50 (shows "1 Lot = 75 units" helper text)
- Limit Price: number input (shown only when LIMIT selected; pre-filled with LTP)

Computed display (updates on field change):
- Estimated Fill: "~₹246.50 (₹0.50 slippage)"
- Margin Required: "₹18,450"
- Available Margin: "₹8,24,500" (green if sufficient, red if not)
- Charges Breakdown: expandable section showing each charge line item

Confirm button:
- Label: "BUY 1 Lot NIFTY 24500 CE" (dynamic)
- Background: green for BUY, red for SELL
- Disabled + spinner while API call in flight
- Disabled if margin insufficient

---

## Portfolio Components

### PositionsTable.tsx

Props: `{ positions: Position[], onClose: (id: string, qty: number) => void }`

Columns: Symbol | Direction | Qty | Entry ₹ | LTP ₹ | P&L ₹ | P&L % | Δ | Θ/day | Margin ₹ | Expiry | Actions

Sorting: click column header to sort (client-side)
Empty state: centered text "No open positions. Visit Option Chain to start trading."

---

### MTMCard.tsx

Props: `{ dailyPnl: number, totalPnl: number, isMarketOpen: boolean }`

Visual:
- Large centered number: today's P&L
- Color: green if positive, red if negative
- Trend arrow: ▲ or ▼ (animated pulse)
- Sub-text: "All time: +₹24,200"
- During market hours: live-updating
- Post-market: shows final EOD number with "EOD" badge

---

### PnLChart.tsx

Props: `{ data: { date: string, pnl: number }[], period: "7D"|"30D"|"90D"|"ALL" }`

Implementation: Recharts ResponsiveContainer + AreaChart
- Gradient fill: top of green gradient at zero, red gradient below zero
- X-axis: date labels (DD MMM format)
- Y-axis: ₹ values with K abbreviation above ₹1,000
- Tooltip: "15 Jan — +₹1,240"
- ReferenceLine at y=0 (dashed white)
- No legend (unnecessary)

---

## Strategy Components

### StrategyBuilder.tsx

Props: none (reads/writes strategyStore)

Manages list of StrategyLeg objects in strategyStore.
Renders: StrategyTemplates + list of LegEditor components + summary + CTA button

---

### LegEditor.tsx

Props:
```
{
  leg: StrategyLeg
  index: number
  onUpdate: (updated: StrategyLeg) => void
  onRemove: () => void
  availableStrikes: OptionStrike[]
}
```

Row layout: [BUY/SELL] [CE/PE] [Expiry ▼] [Strike ▼] [Qty] [LTP] [Δ] [Θ] [✕]

Strike dropdown groups: "--- ITM ---", "--- ATM ---", "--- OTM ---"

---

### PayoffChart.tsx

Props:
```
{
  payoffTable: PayoffPoint[]
  breakevens: number[]
  maxProfit: number | null
  maxLoss: number | null
  currentSpot: number
  scenarioSpot?: number
}
```

Implementation: TradingView Lightweight Charts (AreaSeries)
- Area above zero: color `#00C85340` (profit, transparent green)
- Area below zero: color `#FF3D5740` (loss, transparent red)
- Line: white
- Breakeven markers: dots with floating labels
- CurrentSpot: vertical line, blue, dashed
- ScenarioSpot: vertical line, yellow, dashed (shown when scenario slider active)

---

### ScenarioPanel.tsx

Props:
```
{
  currentSpot: number
  daysToExpiry: number
  onScenarioChange: (params: ScenarioParams) => void
}
```

Three labeled sliders:
1. "Spot Move" — range −15 to +15 (step 1), shows "+5%" or "−3%"
   → calls onScenarioChange on every change (debounced 200ms)
2. "IV Change" — range −10 to +10 (step 0.5), shows "+2.5% IV" 
3. "Days Forward" — range 0 to daysToExpiry (step 1), shows "3 days"

Scenario result box (below sliders):
```
Scenario: NIFTY +5%, IV −2%, 3 days later
Estimated P&L: +₹4,200
Position Delta: +0.23
```

---

## Common Components

### Button.tsx

Props:
```
{
  variant: "primary" | "ghost" | "danger" | "success" | "outline"
  size: "sm" | "md" | "lg"
  loading?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  fullWidth?: boolean
}
```

Variants:
- primary: `bg-accent text-white hover:bg-accent/90`
- ghost: `bg-transparent text-terminal-text hover:bg-terminal-surface`
- danger: `bg-loss text-white hover:bg-loss/90`
- success: `bg-profit text-white hover:bg-profit/90`
- outline: `border border-terminal-border text-terminal-text hover:bg-terminal-surface`

Loading state: shows Spinner, disabled cursor, reduced opacity

---

### Badge.tsx

Props: `{ variant: "CE" | "PE" | "ITM" | "ATM" | "OTM" | "LONG" | "SHORT" | "FILLED" | "PENDING" | "CANCELLED" | "REJECTED", children?: ReactNode }`

Sizes: all badges are small (text-xs, px-2 py-0.5)

Colors:
- CE: blue background, white text
- PE: orange background, white text
- ITM: subtle green background, green text
- ATM: yellow background, dark text
- OTM: muted background, muted text
- LONG: green text, no background
- SHORT: red text, no background
- FILLED: green
- PENDING: yellow
- CANCELLED: muted grey
- REJECTED: red

---

### PriceTag.tsx

Props:
```
{
  value: number        // in paise
  previousValue?: number
  showSign?: boolean   // prepend + for positive
  format: "ltp" | "pnl" | "rupee"
}
```

Behavior:
- Compares `value` to `previousValue` to determine color
- `format="ltp"`: "₹246.50" — 2 decimal places
- `format="pnl"`: "+₹1,240" (green) or "−₹380" (red)
- `format="rupee"`: "₹9,24,500" — Indian comma format
- On value change: 300ms background flash (green flash if up, red flash if down)
- Font: always `font-mono`

---

### Toast.tsx

Global toast container. Position: top-right, 16px from edges.
Max 3 toasts visible simultaneously (older ones exit first).

Toast props:
```
{
  type: "success" | "error" | "warning" | "info"
  title: string
  message?: string
  duration?: number   // ms, default 5000
}
```

Behavior:
- Slide in from right (Framer Motion or CSS transition)
- Auto-dismiss after `duration`
- Manual dismiss via ✕ button
- Success: green left border
- Error: red left border
- Warning: yellow left border
- Info: blue left border

Usage: `toast.success("Order Placed", "Bought 1 lot NIFTY 24500 CE at ₹246.00")`

---

### Modal.tsx

Props:
```
{
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: "sm" | "md" | "lg"
  hideCloseButton?: boolean
}
```

Behavior:
- Backdrop: `bg-black/60 backdrop-blur-sm`
- Close on backdrop click (unless `hideCloseButton` is true — used for dangerous confirmations)
- Close on Escape key
- Trap focus within modal (accessibility)
- Animation: fade in + scale up (200ms)
- No `<form>` tag inside — all button handlers

---

### Tooltip.tsx

Props:
```
{
  content: ReactNode
  children: ReactNode
  placement?: "top" | "bottom" | "left" | "right"
  delay?: number   // ms before showing, default 300
}
```

Implementation: CSS position absolute (not a third-party library)
Background: `#1E2028`, border: `#2A2D3A`, rounded-lg, shadow-xl
Appears after `delay` ms on hover; disappears immediately on mouse leave

---

### Spinner.tsx

Props: `{ size?: "sm" | "md" | "lg", color?: string }`

Simple CSS animation (border-based spinner, no SVG).
Sizes: sm=16px, md=24px, lg=40px

---

## Hooks Reference

### useMarketStatus.ts

Returns:
```typescript
{
  status: "pre_open" | "open" | "closed" | "holiday"
  isOpen: boolean
  timeToOpen: string | null      // "Opens in 45m 30s"
  timeToClose: string | null     // "Closes in 3h 12m"
  currentIST: Date               // live IST time, updates every second
  nextExpiry: Date
  daysToExpiry: number
}
```

Implementation: derives status from IST clock locally (no server call needed)
Uses `ist_clock` logic: 9:15–15:30 = open; 9:00–9:15 = pre-open; else = closed

---

### useDhanWebSocket.ts

Returns:
```typescript
{
  isConnected: boolean
  lastTick: WSTick | null
  subscribe: (securityIds: string[]) => void
  unsubscribe: (securityIds: string[]) => void
  reconnectCount: number
}
```

On mount: connects to `ws://localhost:8000/ws/market-feed?token=<jwt>`
On tick: calls `portfolioStore.updatePositionLTP(securityId, ltp)`
On disconnect: exponential backoff reconnect (max 30s interval)
On market close (15:30 IST): stops reconnecting until next day

---

### useVirtualBalance.ts

Returns:
```typescript
{
  virtualCash: number          // paise
  marginUsed: number           // paise
  availableMargin: number      // paise = virtualCash - marginUsed
  utilizationPct: number       // 0-100
  isLow: boolean               // true if utilizationPct > 75
  isCritical: boolean          // true if utilizationPct > 90
}
```

Data source: `GET /portfolio` (refetches every 30s)
