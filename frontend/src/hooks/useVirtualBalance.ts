import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useMarketStatus } from './useMarketStatus';
import type { Portfolio } from '@/types/paper';

export interface VirtualBalanceResult {
  virtualCash: number;
  marginUsed: number;
  availableMargin: number;
  utilizationPct: number;
  isLow: boolean;
  isCritical: boolean;
}

export function useVirtualBalance(): VirtualBalanceResult {
  const setPortfolio = usePortfolioStore((s) => s.setPortfolio);
  const { isOpen } = useMarketStatus();

  const { data } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data } = await apiClient.get('/portfolio');
      return data as Portfolio;
    },
    refetchInterval: isOpen ? 30000 : 120000,
    staleTime: 10000,
  });

  useEffect(() => {
    if (data) setPortfolio(data);
  }, [data, setPortfolio]);

  const store = usePortfolioStore((s) => ({
    virtualCash: s.virtualCash,
    marginUsed: s.marginUsed,
    marginAvailable: s.marginAvailable,
  }));

  const utilizationPct =
    store.virtualCash > 0
      ? Math.round((store.marginUsed / store.virtualCash) * 10000) / 100
      : 0;

  const isLow = utilizationPct >= 75;
  const isCritical = utilizationPct >= 90;

  return {
    virtualCash: store.virtualCash,
    marginUsed: store.marginUsed,
    availableMargin: store.marginAvailable,
    utilizationPct,
    isLow,
    isCritical,
  };
}
