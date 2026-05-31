import type { Greeks, OptionType } from './paper';

export interface OptionContract {
  security_id: string;
  ltp: number;
  oi: number;
  oi_change: number;
  volume: number;
  iv: number;
  bid: number;
  ask: number;
  greeks: Greeks;
}

export interface OptionStrike {
  strike_price: number;
  is_atm: boolean;
  call: OptionContract;
  put: OptionContract;
}

export interface OptionChain {
  symbol: string;
  expiry: string;
  spot_price: number;
  india_vix: number;
  strikes: OptionStrike[];
  last_updated: string;
  cache_age_seconds: number;
}
