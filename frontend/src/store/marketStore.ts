import { create } from 'zustand';
import type { MarketStatus } from '@/types/paper';

interface MarketState {
  selectedSymbol: string;
  selectedExpiry: string;
  spotPrice: number;
  bankNiftySpot: number;
  indiaVix: number;
  marketStatus: MarketStatus;
  setSymbol: (symbol: string) => void;
  setExpiry: (expiry: string) => void;
  setSpotPrice: (price: number) => void;
  setBankNiftySpot: (price: number) => void;
  setIndiaVix: (vix: number) => void;
  setMarketStatus: (status: MarketStatus) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  selectedSymbol: 'NIFTY',
  selectedExpiry: '',
  spotPrice: 0,
  bankNiftySpot: 0,
  indiaVix: 14.5,
  marketStatus: 'closed',
  setSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setExpiry: (expiry) => set({ selectedExpiry: expiry }),
  setSpotPrice: (price) => set({ spotPrice: price }),
  setBankNiftySpot: (price) => set({ bankNiftySpot: price }),
  setIndiaVix: (vix) => set({ indiaVix: vix }),
  setMarketStatus: (status) => set({ marketStatus: status }),
}));
