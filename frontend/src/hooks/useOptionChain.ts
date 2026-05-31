import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOptionChain, getExpiryList } from '@/services/optionChainService';
import { useMarketStore } from '@/store/marketStore';
import { useMarketStatus } from './useMarketStatus';
import type { OptionChain } from '@/types/options';

export interface OptionChainResult {
  data: OptionChain | undefined;
  isLoading: boolean;
  isError: boolean;
  lastUpdated: string | undefined;
  expiries: string[];
  isExpiriesLoading: boolean;
}

export function useOptionChain(): OptionChainResult {
  const symbol = useMarketStore((s) => s.selectedSymbol);
  const expiry = useMarketStore((s) => s.selectedExpiry);
  const setExpiry = useMarketStore((s) => s.setExpiry);
  const { isOpen } = useMarketStatus();

  const {
    data: expiries,
    isLoading: isExpiriesLoading,
  } = useQuery({
    queryKey: ['option-chain-expiries', symbol],
    queryFn: () => getExpiryList(symbol),
    enabled: !!symbol,
    staleTime: 300000,
  });

  useEffect(() => {
    if (expiries && expiries.length > 0 && !expiry) {
      const first = expiries[0];
      if (first) setExpiry(first);
    }
  }, [expiries, expiry, setExpiry]);

  const {
    data,
    isLoading,
    isError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['option-chain', symbol, expiry],
    queryFn: () => getOptionChain(symbol, expiry),
    enabled: !!symbol && !!expiry,
    refetchInterval: isOpen ? 30000 : false,
    staleTime: isOpen ? 15000 : 60000,
    retry: 2,
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toISOString()
    : undefined;

  return {
    data,
    isLoading,
    isError,
    lastUpdated,
    expiries: expiries ?? [],
    isExpiriesLoading,
  };
}
