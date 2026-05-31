import { useMutation, useQueryClient } from '@tanstack/react-query';
import { placePaperOrder, cancelOrder } from '@/services/paperOrderService';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { PaperOrderCreate, PaperOrder } from '@/types/paper';

export interface PaperOrderResult {
  placePaperOrder: (order: PaperOrderCreate) => Promise<PaperOrder>;
  cancelPaperOrder: (orderId: string) => Promise<PaperOrder>;
  isPlacing: boolean;
  isCancelling: boolean;
}

export function usePaperOrder(): PaperOrderResult {
  const queryClient = useQueryClient();
  const addOrder = usePortfolioStore((s) => s.addOrder);

  const { mutateAsync: placeMutation, isPending: isPlacing } = useMutation({
    mutationFn: placePaperOrder,
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousOrders = queryClient.getQueryData<PaperOrder[]>(['orders']);

      const optimistic: PaperOrder = {
        ...newOrder,
        id: `temp-${Date.now()}`,
        user_id: '',
        lot_size: 0,
        status: 'PENDING',
        charges: {
          brokerage: 0,
          stt: 0,
          exchange_charges: 0,
          gst: 0,
          stamp_duty: 0,
          sebi_fee: 0,
          total: 0,
        },
        margin_blocked: 0,
        created_at: new Date().toISOString(),
      };

      addOrder(optimistic);

      return { previousOrders };
    },
    onError: (_err, _order, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const { mutateAsync: cancelMutation, isPending: isCancelling } = useMutation({
    mutationFn: cancelOrder,
    onMutate: async (orderId) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousOrders = queryClient.getQueryData<PaperOrder[]>(['orders']);

      queryClient.setQueryData<PaperOrder[]>(['orders'], (old) =>
        old?.filter((o) => o.id !== orderId) ?? []
      );

      return { previousOrders };
    },
    onError: (_err, _orderId, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return {
    placePaperOrder: placeMutation,
    cancelPaperOrder: cancelMutation,
    isPlacing,
    isCancelling,
  };
}
