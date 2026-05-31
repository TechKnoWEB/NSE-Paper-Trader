import { create } from 'zustand';
import { supabase } from '@/services/supabase';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setToken: (token: string) => void;
  clearToken: () => void;
  setLoading: (loading: boolean) => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isAuthenticated: false,
  isLoading: true,
  setToken: (token) => {
    set({ token, isAuthenticated: true });
  },
  clearToken: () => {
    set({ token: null, isAuthenticated: false });
  },
  setLoading: (loading) => {
    set({ isLoading: loading });
  },
  initializeAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        set({ token: session.access_token, isAuthenticated: true });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));

interface SettingsState {
  dailyLossLimit: number;
  maxLotsPerOrder: number;
  maxLotsPerPosition: number;
  maxOpenPositions: number;
  marginCapPct: number;
  stopLossPct: number | null;
  defaultIndex: string;
  strikesRange: number;
  setSetting: <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  dailyLossLimit: 500000,
  maxLotsPerOrder: 50,
  maxLotsPerPosition: 100,
  maxOpenPositions: 20,
  marginCapPct: 0.8,
  stopLossPct: null,
  defaultIndex: 'NIFTY',
  strikesRange: 10,
  setSetting: (key, value) => set({ [key]: value }),
}));
