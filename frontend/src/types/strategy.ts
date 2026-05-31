import type { OrderAction, OptionType, Greeks } from './paper';

export type StrategyName =
  | "LONG_CALL" | "LONG_PUT" | "BULL_CALL_SPREAD" | "BEAR_PUT_SPREAD"
  | "LONG_STRADDLE" | "SHORT_STRADDLE" | "LONG_STRANGLE" | "SHORT_STRANGLE"
  | "IRON_CONDOR" | "IRON_BUTTERFLY" | "COVERED_CALL" | "PROTECTIVE_PUT"
  | "CUSTOM";

export interface StrategyLeg {
  id: string;
  action: OrderAction;
  option_type: OptionType;
  strike_price: number;
  expiry_date: string;
  quantity: number;
  security_id?: string;
  ltp?: number;
  greeks?: Greeks;
}

export interface ScenarioParams {
  spot_delta_pct: number;
  iv_shift_pct: number;
  days_forward: number;
}

export interface PayoffPoint {
  spot_price: number;
  pnl: number;
}

export interface StrategyAnalysis {
  name: StrategyName;
  legs: StrategyLeg[];
  max_profit: number | null;
  max_loss: number | null;
  breakevens: number[];
  payoff_table: PayoffPoint[];
  net_premium: number;
  net_greeks: Greeks;
  margin_required: number;
}
