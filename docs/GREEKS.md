# GREEKS.md

> Options Greeks specification and Black-Scholes implementation contract.
> Both frontend (TypeScript) and backend (Python) implementations must follow
> this exact spec to produce identical results.

---

## When Greeks Are Used

**Primary source**: Dhan option chain API — supplies Delta, Gamma, Theta, Vega, Rho
per strike. Use these values when available.

**Fallback (Black-Scholes)**: When Dhan doesn't return Greeks for a strike (far OTM,
new contract), compute them ourselves using the formulas below.

**Strategy payoff**: Always use our own B-S for what-if analysis (spot ±%, IV change,
days forward) because Dhan doesn't recalculate Greeks for hypothetical scenarios.

**Portfolio Greeks**: Sum of all position Greeks (weighted by quantity and direction).

---

## Inputs to Black-Scholes

| Parameter | Symbol | Source | Notes |
|---|---|---|---|
| Spot price | S | Dhan live quote for underlying | In rupees (not paise) for B-S math |
| Strike price | K | Option contract strike | In rupees |
| Time to expiry | T | `ist_clock.get_time_to_expiry_years()` | In years; e.g. 7 days = 7/365 = 0.01918 |
| Risk-free rate | r | RBI repo rate ≈ 0.065 (6.5%) | Constant; update quarterly in settings.py |
| Implied volatility | σ | From Dhan option chain; or Newton-Raphson inversion | Decimal: 18% = 0.18 |
| Option type | — | "CE" or "PE" | Determines Call or Put formula |

**Important**: NSE index options (NIFTY, BANK NIFTY) are **European-style**. Use the
standard European Black-Scholes formula. NSE stock options are **American-style** but
B-S gives a close approximation for short-dated contracts.

---

## Black-Scholes Formula

### Step 1: Compute d1 and d2

```
d1 = [ ln(S/K) + (r + σ²/2) × T ] / (σ × √T)
d2 = d1 - σ × √T
```

### Step 2: Call Price
```
C = S × N(d1) - K × e^(-r×T) × N(d2)
```

### Step 3: Put Price (via Put-Call Parity)
```
P = K × e^(-r×T) × N(-d2) - S × N(-d1)
```

Where `N(x)` is the cumulative standard normal distribution function.

### Standard Normal CDF (N(x))

Use the Hart approximation for numerical accuracy:
```
For x ≥ 0:
  k = 1 / (1 + 0.2316419 × x)
  N(x) = 1 - n(x) × k × (0.319381530 + k × (-0.356563782 + k × (1.781477937 + k × (-1.821255978 + k × 1.330274429))))

For x < 0:
  N(x) = 1 - N(-x)

Where n(x) = (1/√2π) × e^(-x²/2)   [standard normal PDF]
```

---

## Greeks Formulas

All Greeks must match these formulas exactly. Both Python and TypeScript implementations
are tested against known reference values (see `backend/tests/test_greeks.py`).

### Delta (Δ)
Measures option price change per 1-unit change in underlying.
```
Call Delta = N(d1)
Put Delta = N(d1) - 1   [always negative for puts: range -1 to 0]
```

### Gamma (Γ)
Measures Delta's rate of change per 1-unit change in underlying.
```
Gamma = n(d1) / (S × σ × √T)
```
Same for both calls and puts. Always positive. Highest at ATM near expiry.

### Theta (Θ)
Measures option price decay per 1 calendar day.
```
Call Theta = [ -S × n(d1) × σ / (2 × √T) - r × K × e^(-r×T) × N(d2) ] / 365
Put Theta  = [ -S × n(d1) × σ / (2 × √T) + r × K × e^(-r×T) × N(-d2) ] / 365
```
Always negative for option buyers. Divide by 365 for per-calendar-day decay.
Display as per-day in rupees: Theta × lot_size × quantity_in_lots.

### Vega (V)
Measures option price change per 1% change in IV.
```
Vega = S × n(d1) × √T / 100
```
Same for both calls and puts. Divide by 100 so it represents change per 1% IV move.
Always positive for option buyers.

### Rho (ρ)
Measures option price change per 1% change in risk-free interest rate.
```
Call Rho = K × T × e^(-r×T) × N(d2) / 100
Put Rho  = -K × T × e^(-r×T) × N(-d2) / 100
```
Divide by 100 for per-1% rate change. Less significant for short-dated options.
Positive for calls, negative for puts.

---

## Implied Volatility (IV) Inversion

When we have the market price of an option and need to compute the IV that justifies it,
use Newton-Raphson iteration:

```
1. Start with initial guess: σ = 0.30 (30%)
2. Compute theoretical price C_theory using B-S with current σ
3. Compute Vega (dC/dσ)
4. Update: σ_new = σ - (C_theory - C_market) / Vega
5. Repeat until |C_theory - C_market| < 0.001 (convergence)
6. Maximum iterations: 100 (prevents infinite loop for deep ITM/OTM)
7. If no convergence: return None (IV unavailable)
```

---

## Portfolio-Level Greeks

When a user has multiple open positions, compute net portfolio Greeks:

```
net_delta = Σ position_i.delta × position_i.quantity × direction_i
net_gamma = Σ position_i.gamma × position_i.quantity × direction_i
net_theta = Σ position_i.theta × position_i.quantity × direction_i
net_vega  = Σ position_i.vega  × position_i.quantity × direction_i

Where:
  direction_i = +1 for long (bought) positions
  direction_i = -1 for short (sold) positions
  position_i.quantity = number of contracts (NOT lots)
  contracts = lots × lot_size
```

Example: Long 1 lot NIFTY ATM CE (lot size = 75, delta = 0.5)
```
position_delta = 0.5 × 75 × 1 = 37.5
"Portfolio delta = 37.5" means portfolio gains ₹37.50 per 1-point NIFTY rise
```

---

## What-If Scenario Calculations (PayoffChart)

The PayoffChart shows P&L across a range of spot prices at a future time.

For each spot price point on the X-axis:
```
1. For each strategy leg:
   a. Compute theoretical option price using B-S with:
      - S = scenario_spot_price
      - σ = original_iv + scenario_iv_shift (%)
      - T = original_T - scenario_days_forward / 365
   b. leg_pnl = (theoretical_price - entry_price) × quantity × direction
2. total_pnl = Σ leg_pnl across all legs (minus entry charges, plus exit charges)
3. Plot (scenario_spot, total_pnl)
```

Spot price range: current spot ±15% in 50-point increments for NIFTY.

---

## Reference Values for Testing

These values are used in unit tests to validate the implementation:

```
Scenario: NIFTY ATM Call
  S = 22000, K = 22000, T = 7/365, r = 0.065, σ = 0.18

Expected:
  d1 ≈ 0.1456
  d2 ≈ 0.1049
  Call Price ≈ ₹168.50 (±₹2 acceptable due to approximation method)
  Call Delta ≈ 0.4578  (ATM call, should be close to 0.5)
  Gamma ≈ 0.0021
  Theta ≈ -₹22.40/day  (for 1 lot = 75 units)
  Vega ≈ ₹6.20/1%IV   (for 1 unit)

Scenario: Deep ITM Put
  S = 22000, K = 24000, T = 30/365, r = 0.065, σ = 0.20

Expected:
  Put Delta ≈ -0.95 (deep ITM put behaves like short underlying)
  Gamma ≈ 0.0003 (low gamma for deep ITM)
```

---

## Display Conventions

| Greek | Decimal Places | Sign | Unit |
|---|---|---|---|
| Delta | 4 | +/- | per ₹1 move |
| Gamma | 4 | always + | per ₹1 move |
| Theta | 2 | always - for buyers | ₹ per day |
| Vega | 2 | always + for buyers | ₹ per 1% IV |
| Rho | 2 | +/- | ₹ per 1% rate |

Theta display in portfolio: show daily decay as "₹-450/day" (Theta × lots × lot_size).
This tells the user concretely how much time is costing them each day.
