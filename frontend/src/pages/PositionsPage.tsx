import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePositions } from '@/hooks/usePositions';
import { useGreeks } from '@/hooks/useGreeks';
import PositionsTable from '@/components/portfolio/PositionsTable';
import TradeJournal from '@/components/portfolio/TradeJournal';
import Spinner from '@/components/common/Spinner';
import apiClient from '@/services/apiClient';
import type { Trade } from '@/types/paper';
import { formatGreek } from '@/utils/formatters';

type Tab = 'open' | 'history';

export default function PositionsPage() {
  const [tab, setTab] = useState<Tab>('open');
  const { positions, isLoading, isError, refetch, closePosition, isClosing } = usePositions();
  const { netDelta, netGamma, netTheta, netVega } = useGreeks(positions);

  const {
    data: trades,
    isLoading: tradesLoading,
    isError: tradesError,
  } = useQuery({
    queryKey: ['trades'],
    queryFn: async () => {
      const { data } = await apiClient.get('/positions/closed');
      return data as Trade[];
    },
    staleTime: 30000,
  });

  const handleClose = (id: string, qty: number) => {
    closePosition(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-terminal-surface rounded-lg border border-terminal-border p-1 w-fit">
        <button
          onClick={() => setTab('open')}
          className={`px-4 py-2 text-sm font-ui rounded-md transition-colors cursor-pointer ${
            tab === 'open'
              ? 'bg-accent text-white'
              : 'text-terminal-muted hover:text-terminal-text'
          }`}
        >
          Open Positions
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-ui rounded-md transition-colors cursor-pointer ${
            tab === 'history'
              ? 'bg-accent text-white'
              : 'text-terminal-muted hover:text-terminal-text'
          }`}
        >
          Trade History
        </button>
      </div>

      {tab === 'open' && (
        <>
          {positions.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {([
                { label: 'Net \u0394', value: netDelta, greek: 'delta' as const },
                { label: 'Net \u0393', value: netGamma, greek: 'gamma' as const },
                { label: 'Net \u0398', value: netTheta, greek: 'theta' as const },
                { label: 'Net V', value: netVega, greek: 'vega' as const },
              ]).map(({ label, value, greek }) => (
                <div key={label} className="bg-terminal-surface rounded-lg border border-terminal-border p-3">
                  <div className="text-[10px] text-terminal-muted font-ui uppercase tracking-wider">{label}</div>
                  <div className="text-lg font-mono text-terminal-text mt-1">{formatGreek(value, greek)}</div>
                </div>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-terminal-muted">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-50">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h0" />
              </svg>
              <p className="text-lg font-ui">Failed to load positions</p>
              <button
                onClick={() => refetch()}
                className="mt-3 text-sm text-accent hover:underline font-ui cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : (
            <PositionsTable positions={positions} onClose={handleClose} />
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          {tradesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : tradesError ? (
            <div className="flex flex-col items-center justify-center py-16 text-terminal-muted">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-50">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h0" />
              </svg>
              <p className="text-lg font-ui">Failed to load trade history</p>
            </div>
          ) : (
            <TradeJournal trades={trades ?? []} />
          )}
        </>
      )}
    </div>
  );
}
