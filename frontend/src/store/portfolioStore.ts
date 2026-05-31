import { create } from 'zustand';
import type { Position, PaperOrder, Portfolio } from '@/types/paper';

interface PortfolioState {
  virtualCash: number;
  marginUsed: number;
  marginAvailable: number;
  positions: Position[];
  orders: PaperOrder[];
  dailyPnL: number;
  totalPnL: number;
  setPortfolio: (p: Portfolio) => void;
  setPositions: (positions: Position[]) => void;
  addPosition: (position: Position) => void;
  removePosition: (id: string) => void;
  updatePositionLTP: (securityId: string, ltp: number) => void;
  setOrders: (orders: PaperOrder[]) => void;
  addOrder: (order: PaperOrder) => void;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  virtualCash: 100000000,
  marginUsed: 0,
  marginAvailable: 100000000,
  positions: [],
  orders: [],
  dailyPnL: 0,
  totalPnL: 0,

  setPortfolio: (p) =>
    set({
      virtualCash: p.virtual_cash,
      marginUsed: p.margin_used,
      marginAvailable: p.margin_available,
      dailyPnL: p.daily_pnl,
      totalPnL: p.total_pnl,
    }),

  setPositions: (positions) => set({ positions }),

  addPosition: (position) =>
    set((state) => ({
      positions: [...state.positions, position],
    })),

  removePosition: (id) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    })),

  updatePositionLTP: (securityId, ltp) =>
    set((state) => {
      const positions = state.positions.map((p) => {
        if (p.security_id !== securityId) return p;
        const direction = p.direction === 'LONG' ? 1 : -1;
        const unrealized_pnl =
          (ltp - p.avg_entry_price) * p.quantity * direction;
        return { ...p, last_ltp: ltp, unrealized_pnl };
      });
      const totalPnL = positions.reduce(
        (sum, p) => sum + (p.unrealized_pnl ?? 0),
        0
      );
      return { positions, totalPnL };
    }),

  setOrders: (orders) => set({ orders }),

  addOrder: (order) =>
    set((state) => ({
      orders: [order, ...state.orders],
    })),
}));
