export type OrderAction = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "SL_MARKET" | "SL_LIMIT";
export type OrderStatus = "PENDING" | "FILLED" | "CANCELLED" | "REJECTED";
export type OptionType = "CE" | "PE";
export type PositionDirection = "LONG" | "SHORT";
export type MarketStatus = "pre_open" | "open" | "closed" | "holiday";

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface ChargesBreakdown {
  brokerage: number;
  stt: number;
  exchange_charges: number;
  gst: number;
  stamp_duty: number;
  sebi_fee: number;
  total: number;
}

export interface PaperOrderCreate {
  security_id: string;
  symbol: string;
  underlying: string;
  strike_price: number;
  option_type: OptionType;
  expiry_date: string;
  exchange_segment: string;
  action: OrderAction;
  order_type: OrderType;
  quantity: number;
  limit_price?: number;
  trigger_price?: number;
  strategy_tag?: string;
  notes?: string;
}

export interface PaperOrder extends PaperOrderCreate {
  id: string;
  user_id: string;
  lot_size: number;
  status: OrderStatus;
  fill_price?: number;
  fill_timestamp?: string;
  charges: ChargesBreakdown;
  margin_blocked: number;
  created_at: string;
}

export interface Position {
  id: string;
  user_id: string;
  security_id: string;
  symbol: string;
  underlying: string;
  strike_price: number;
  option_type: OptionType;
  expiry_date: string;
  exchange_segment: string;
  lot_size: number;
  direction: PositionDirection;
  quantity: number;
  avg_entry_price: number;
  margin_blocked: number;
  greeks: Greeks;
  last_ltp: number;
  unrealized_pnl: number;
  strategy_tag?: string;
  stop_loss_pct?: number;
  created_at: string;
}

export interface Trade {
  id: string;
  security_id: string;
  symbol: string;
  direction: PositionDirection;
  quantity: number;
  entry_price: number;
  exit_price: number;
  gross_pnl: number;
  total_charges: number;
  net_pnl: number;
  strategy_tag?: string;
  entry_timestamp: string;
  exit_timestamp: string;
  notes?: string;
}

export interface Portfolio {
  virtual_cash: number;
  margin_used: number;
  margin_available: number;
  daily_pnl: number;
  total_pnl: number;
  total_realized_pnl: number;
  unrealized_pnl: number;
  total_equity: number;
  positions_count: number;
  subscription_tier: string;
  net_delta: number;
  net_theta: number;
  net_vega: number;
  net_gamma: number;
  net_rho: number;
}
