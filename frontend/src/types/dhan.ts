export interface DhanGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface DhanOptionContract {
  security_id: string;
  last_price: number;
  open_interest: number;
  volume: number;
  implied_volatility: number;
  bid: number;
  ask: number;
  greeks: DhanGreeks;
}

export interface DhanStrikeData {
  strike_price: number;
  call_options: DhanOptionContract;
  put_options: DhanOptionContract;
}

export interface DhanOptionChainResponse {
  last_price: number;
  expiry: string;
  option_chain_data: DhanStrikeData[];
}

export interface DhanQuoteData {
  last_price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}

export interface DhanTick {
  type: string;
  exchange_segment: number;
  security_id: string;
  LTP: number;
  volume: number;
  oi: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
