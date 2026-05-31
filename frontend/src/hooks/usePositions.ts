import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useMarketStatus } from './useMarketStatus';
import type { Position } from '@/types/paper';

export interface PositionsResult {
  positions: Position[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  closePosition: (id: string) => Promise<void>;
  isClosing: boolean;
}

export function usePositions(): PositionsResult {
  const queryClient = useQueryClient();
  const setPositions = usePortfolioStore((s) => s.setPositions);
  const removePosition = usePortfolioStore((s) => s.removePosition);
  const { isOpen } = useMarketStatus();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data } = await apiClient.get('/positions', {
        params: { status: 'OPEN' },
      });
      return data as Position[];
    },
    refetchInterval: isOpen ? 10000 : 60000,
    staleTime: 5000,
  });

  useEffect(() => {
    if (data) setPositions(data);
  }, [data, setPositions]);

  const { mutateAsync: closePosition, isPending: isClosing } = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/positions/${id}/close`);
    },
    onSuccess: (_data, id) => {
      removePosition(id);
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const positions = usePortfolioStore((s) => s.positions);

  return {
    positions,
    isLoading,
    isError,
    refetch,
    closePosition,
    isClosing,
  };
}
