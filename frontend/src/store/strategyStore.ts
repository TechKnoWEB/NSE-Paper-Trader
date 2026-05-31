import { create } from 'zustand';
import type {
  StrategyLeg,
  StrategyName,
  ScenarioParams,
  PayoffPoint,
} from '@/types/strategy';
import type { Greeks } from '@/types/paper';

interface StrategyState {
  legs: StrategyLeg[];
  underlyingPrice: number;
  scenarioSpotDelta: number;
  scenarioIvDelta: number;
  scenarioDaysDelta: number;
  strategyName: StrategyName;
  payoffTable: PayoffPoint[];
  breakevens: number[];
  maxProfit: number | null;
  maxLoss: number | null;
  netPremium: number;
  netGreeks: Greeks;
  setLegs: (legs: StrategyLeg[]) => void;
  addLeg: (leg: StrategyLeg) => void;
  removeLeg: (id: string) => void;
  updateLeg: (id: string, updates: Partial<StrategyLeg>) => void;
  setUnderlyingPrice: (price: number) => void;
  setScenario: (params: Partial<ScenarioParams>) => void;
  setStrategyName: (name: StrategyName) => void;
  setPayoffData: (data: Partial<StrategyState>) => void;
  reset: () => void;
}

const DEFAULT_GREEKS: Greeks = {
  delta: 0,
  gamma: 0,
  theta: 0,
  vega: 0,
  rho: 0,
};

export const useStrategyStore = create<StrategyState>((set) => ({
  legs: [],
  underlyingPrice: 0,
  scenarioSpotDelta: 0,
  scenarioIvDelta: 0,
  scenarioDaysDelta: 0,
  strategyName: 'CUSTOM',
  payoffTable: [],
  breakevens: [],
  maxProfit: null,
  maxLoss: null,
  netPremium: 0,
  netGreeks: { ...DEFAULT_GREEKS },

  setLegs: (legs) => set({ legs }),
  addLeg: (leg) => set((s) => ({ legs: [...s.legs, leg] })),
  removeLeg: (id) =>
    set((s) => ({ legs: s.legs.filter((l) => l.id !== id) })),
  updateLeg: (id, updates) =>
    set((s) => ({
      legs: s.legs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),
  setUnderlyingPrice: (price) => set({ underlyingPrice: price }),
  setScenario: (params) =>
    set((s) => ({
      scenarioSpotDelta: params.spot_delta_pct ?? s.scenarioSpotDelta,
      scenarioIvDelta: params.iv_shift_pct ?? s.scenarioIvDelta,
      scenarioDaysDelta: params.days_forward ?? s.scenarioDaysDelta,
    })),
  setStrategyName: (name) => set({ strategyName: name }),
  setPayoffData: (data) => set(data),
  reset: () =>
    set({
      legs: [],
      payoffTable: [],
      breakevens: [],
      maxProfit: null,
      maxLoss: null,
      netPremium: 0,
      netGreeks: { ...DEFAULT_GREEKS },
      scenarioSpotDelta: 0,
      scenarioIvDelta: 0,
      scenarioDaysDelta: 0,
    }),
}));
