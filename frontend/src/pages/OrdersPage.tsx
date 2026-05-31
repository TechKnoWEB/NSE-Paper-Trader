import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { getOrders, cancelOrder } from '@/services/paperOrderService';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Spinner from '@/components/common/Spinner';
import { toast } from '@/components/common/Toast';
import { formatLTP, formatDate, formatTime, formatRupee } from '@/utils/formatters';
import type { PaperOrder, OrderStatus } from '@/types/paper';

const STATUS_FILTERS: (OrderStatus | 'ALL')[] = ['ALL', 'FILLED', 'CANCELLED', 'REJECTED'];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: () => getOrders({ status: 'PENDING', page: 1, limit: 50 }),
    refetchInterval: 15000,
  });

  const params: { status?: string; page: number; limit: number } = {
    page,
    limit: pageSize,
  };
  if (statusFilter !== 'ALL') params.status = statusFilter;

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['orders', 'history', statusFilter, page],
    queryFn: () => getOrders(params),
    staleTime: 10000,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      toast.success('Order cancelled');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => {
      toast.error('Failed to cancel order');
    },
  });

  const pendingOrders = pendingData?.items ?? [];
  const historyOrders = historyData?.items ?? [];
  const totalHistory = historyData?.total ?? 0;
  const totalPages = Math.ceil(totalHistory / pageSize);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-ui text-terminal-muted uppercase tracking-wider mb-3">
          Pending Orders
        </h2>

        {pendingLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : pendingOrders.length === 0 ? (
          <div className="bg-terminal-surface rounded-lg border border-terminal-border p-8 text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-terminal-muted opacity-40">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 12h6M12 9v6" />
            </svg>
            <p className="text-terminal-muted font-ui text-sm">
              No pending limit orders. Market orders fill instantly.
            </p>
          </div>
        ) : (
          <div className="bg-terminal-surface rounded-lg border border-terminal-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terminal-border">
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Time</th>
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Symbol</th>
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Action</th>
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Type</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Qty</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Limit Price</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                  {pendingOrders.map((order) => {
                    return (
                      <tr key={order.id} className="border-b border-terminal-border/50 hover:bg-terminal-bg/50 transition-colors">
                        <td className="px-3 py-3 font-mono text-terminal-muted whitespace-nowrap">{formatTime(order.created_at)}</td>
                        <td className="px-3 py-3 font-mono text-terminal-text whitespace-nowrap">{order.symbol}</td>
                        <td className="px-3 py-3 whitespace-nowrap"><Badge variant={order.action as any} /></td>
                        <td className="px-3 py-3 font-mono text-terminal-muted whitespace-nowrap">{order.order_type}</td>
                        <td className="px-3 py-3 font-mono text-terminal-text text-right whitespace-nowrap">{order.quantity}</td>
                        <td className="px-3 py-3 font-mono text-terminal-text text-right whitespace-nowrap">
                          {order.limit_price ? formatLTP(order.limit_price) : '--'}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelMutation.mutate(order.id)}
                            loading={cancelMutation.isPending}
                          >
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-ui text-terminal-muted uppercase tracking-wider">
            Order History
          </h2>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                  statusFilter === s
                    ? 'bg-accent text-white'
                    : 'text-terminal-muted hover:text-terminal-text bg-terminal-bg'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : historyOrders.length === 0 ? (
          <div className="bg-terminal-surface rounded-lg border border-terminal-border p-8 text-center">
            <p className="text-terminal-muted font-ui text-sm">No orders found</p>
          </div>
        ) : (
          <div className="bg-terminal-surface rounded-lg border border-terminal-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terminal-border">
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Time</th>
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Symbol</th>
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Action</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Qty</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Fill Price</th>
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Charges</th>
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {historyOrders.map((order) => (
                  <tr key={order.id} className="border-b border-terminal-border/50 hover:bg-terminal-bg/50 transition-colors">
                    <td className="px-3 py-3 font-mono text-terminal-muted whitespace-nowrap">{formatDate(order.created_at)}</td>
                    <td className="px-3 py-3 font-mono text-terminal-text whitespace-nowrap">{order.symbol}</td>
                    <td className="px-3 py-3 whitespace-nowrap"><Badge variant={order.action as any} /></td>
                    <td className="px-3 py-3 font-mono text-terminal-text text-right whitespace-nowrap">{order.quantity}</td>
                    <td className="px-3 py-3 font-mono text-terminal-text text-right whitespace-nowrap">
                      {order.fill_price ? formatLTP(order.fill_price) : '--'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap"><Badge variant={order.status} /></td>
                    <td className="px-3 py-3 font-mono text-terminal-muted text-right whitespace-nowrap">
                      {order.charges?.total ? formatRupee(order.charges.total) : '--'}
                    </td>
                    <td className="px-3 py-3 text-terminal-muted text-xs max-w-[120px] truncate">
                      {order.notes ?? '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-mono bg-terminal-surface border border-terminal-border rounded text-terminal-muted hover:text-terminal-text disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="text-xs font-mono text-terminal-muted">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-mono bg-terminal-surface border border-terminal-border rounded text-terminal-muted hover:text-terminal-text disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
