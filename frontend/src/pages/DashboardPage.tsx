import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMarketStore } from '@/store/marketStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useDhanWebSocket } from '@/hooks/useDhanWebSocket';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import apiClient from '@/services/apiClient';
import MTMCard from '@/components/portfolio/MTMCard';
import MarginCard from '@/components/portfolio/MarginCard';
import PnLChart from '@/components/portfolio/PnLChart';
import Badge from '@/components/common/Badge';
import { formatRupee, formatLTP, formatPnL, formatDate } from '@/utils/formatters';
import { getPnlClass, getMarketStatusColor } from '@/utils/colors';
import type { Position, Portfolio } from '@/types/paper';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isOpen, marketStatus, istTime, nextExpiry, daysToExpiry } = useMarketStatus();
  const { isConnected } = useDhanWebSocket();

  const spotPrice = useMarketStore((s) => s.spotPrice);
  const bankNiftySpot = useMarketStore((s) => s.bankNiftySpot);
  const indiaVix = useMarketStore((s) => s.indiaVix);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  const positions = usePortfolioStore((s) => s.positions);
  const dailyPnL = usePortfolioStore((s) => s.dailyPnL);
  const totalPnL = usePortfolioStore((s) => s.totalPnL);
  const virtualCash = usePortfolioStore((s) => s.virtualCash);
  const marginUsed = usePortfolioStore((s) => s.marginUsed);
  const marginAvailable = usePortfolioStore((s) => s.marginAvailable);
  const setPortfolio = usePortfolioStore((s) => s.setPortfolio);
  const setPositions = usePortfolioStore((s) => s.setPositions);

  const [pnlPeriod, setPnlPeriod] = useState('7D');

  useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data } = await apiClient.get('/portfolio');
      setPortfolio(data as Portfolio);
      return data as Portfolio;
    },
    refetchInterval: isOpen ? 30000 : 120000,
    staleTime: 10000,
  });

  useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data } = await apiClient.get('/positions', {
        params: { status: 'OPEN' },
      });
      setPositions(data as Position[]);
      return data as Position[];
    },
    refetchInterval: isOpen ? 10000 : 60000,
    staleTime: 5000,
  });

  const pnlDays = useMemo(() => {
    const map: Record<string, number> = { '7D': 7, '30D': 30, '90D': 90, 'ALL': 365 };
    return map[pnlPeriod] ?? 30;
  }, [pnlPeriod]);

  const { data: pnlHistory } = useQuery({
    queryKey: ['portfolio', 'pnl-history', pnlDays],
    queryFn: async () => {
      const { data } = await apiClient.get('/portfolio/pnl-history', {
        params: { days: pnlDays },
      });
      return data as { date: string; pnl: number }[];
    },
    refetchInterval: 300000,
    staleTime: 60000,
  });

  const topPositions = useMemo(() => {
    return [...positions]
      .sort((a, b) => Math.abs(b.unrealized_pnl ?? 0) - Math.abs(a.unrealized_pnl ?? 0))
      .slice(0, 5);
  }, [positions]);

  const statusColor = getMarketStatusColor(marketStatus);
  const statusLabel = marketStatus === 'open' ? 'Market Open' : marketStatus === 'pre_open' ? 'Pre-Open' : marketStatus === 'holiday' ? 'Holiday' : 'Market Closed';
  const vixColor = indiaVix < 14 ? '#00C853' : indiaVix < 20 ? '#FFB300' : '#FF3D57';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MTMCard dailyPnl={dailyPnL} totalPnl={totalPnL} isMarketOpen={isOpen} />

        <MarginCard virtualCash={virtualCash} marginUsed={marginUsed} />

        <button
          onClick={() => navigate('/positions')}
          className="bg-terminal-surface rounded-lg border border-terminal-border p-4 text-left transition-colors hover:border-accent/30 cursor-pointer group"
        >
          <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-2">
            Open Positions
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-terminal-text group-hover:text-accent transition-colors">
              {positions.length}
            </span>
            <span className="text-xs text-terminal-muted font-mono">
              {positions.length > 0 ? `${positions.reduce((s, p) => s + p.quantity, 0)} lots` : 'no trades'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs font-mono">
            <span className="text-terminal-muted">Net Delta:</span>
            <span className="text-terminal-text">
              {positions.reduce((s, p) => s + p.greeks.delta * p.quantity * (p.direction === 'LONG' ? 1 : -1), 0).toFixed(2)}
            </span>
          </div>
        </button>

        <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
          <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-2">
            India VIX
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold" style={{ color: vixColor }}>
              {indiaVix.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-terminal-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((indiaVix / 40) * 100, 100)}%`,
                  backgroundColor: vixColor,
                }}
              />
            </div>
            <span className="text-[10px] text-terminal-muted font-mono w-8 text-right">
              {((indiaVix / 40) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-4">
        <div className="bg-terminal-surface rounded-lg border border-terminal-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
            <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider">
              Top Positions
            </span>
            {positions.length > 5 && (
              <button
                onClick={() => navigate('/positions')}
                className="text-[11px] text-accent hover:text-accent/80 font-mono transition-colors cursor-pointer"
              >
                View all ({positions.length})
              </button>
            )}
          </div>

          {topPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-terminal-muted">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-40">
                <path d="M12 2v20M2 12h20" />
              </svg>
              <p className="text-sm font-ui">No open positions</p>
              <p className="text-xs mt-1">Head to Option Chain to start trading.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-terminal-border/50">
                    {['Symbol', 'Dir', 'Qty', 'Entry', 'LTP', 'P&L', 'Expiry'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-[10px] text-terminal-muted font-ui uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topPositions.map((pos) => (
                    <tr
                      key={pos.id}
                      className="border-b border-terminal-border/30 hover:bg-terminal-bg/50 transition-colors"
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-terminal-text whitespace-nowrap">
                        {pos.symbol}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant={pos.direction} />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-terminal-text whitespace-nowrap">
                        {pos.quantity}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-terminal-muted whitespace-nowrap">
                        {formatLTP(pos.avg_entry_price)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-terminal-text whitespace-nowrap">
                        {formatLTP(pos.last_ltp)}
                      </td>
                      <td className={clsx('px-3 py-2.5 font-mono text-xs whitespace-nowrap', getPnlClass(pos.unrealized_pnl))}>
                        {formatPnL(pos.unrealized_pnl)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-terminal-muted whitespace-nowrap">
                        {formatDate(pos.expiry_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
          <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-4">
            Market Status
          </span>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-terminal-muted font-ui">Status</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
                <span className="text-xs font-mono text-terminal-text">{statusLabel}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-terminal-muted font-ui">Time (IST)</span>
              <span className="text-xs font-mono text-terminal-text">{istTime}</span>
            </div>

            <div className="border-t border-terminal-border/50" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-terminal-muted font-ui">NIFTY</span>
                <span className="text-xs font-mono text-terminal-text">
                  {spotPrice > 0 ? `${(spotPrice / 100).toFixed(2)}` : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-terminal-muted font-ui">BANK NIFTY</span>
                <span className="text-xs font-mono text-terminal-text">
                  {bankNiftySpot > 0 ? `${(bankNiftySpot / 100).toFixed(2)}` : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-terminal-muted font-ui">India VIX</span>
                <span className="text-xs font-mono text-terminal-text" style={{ color: vixColor }}>
                  {indiaVix.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="border-t border-terminal-border/50" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-terminal-muted font-ui">Next Expiry</span>
                <span className="text-xs font-mono text-terminal-text">
                  {formatDate(nextExpiry.toISOString())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-terminal-muted font-ui">Days to Expiry</span>
                <span className="text-xs font-mono text-terminal-text">
                  {daysToExpiry} day{daysToExpiry !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="border-t border-terminal-border/50" />

            <div className="flex items-center justify-between">
              <span className="text-xs text-terminal-muted font-ui">WebSocket</span>
              <div className="flex items-center gap-1.5">
                <span className={clsx('w-1.5 h-1.5 rounded-full', isConnected ? 'bg-profit' : 'bg-loss')} />
                <span className={clsx('text-[10px] font-mono', isConnected ? 'text-profit' : 'text-loss')}>
                  {isConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-terminal-muted font-ui">Virtual Balance</span>
              <span className="text-xs font-mono text-profit font-medium">
                {formatRupee(marginAvailable)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <PnLChart
        data={pnlHistory ?? []}
        period={pnlPeriod as '7D' | '30D' | '90D' | 'ALL'}
        onPeriodChange={(p) => setPnlPeriod(p as '7D' | '30D' | '90D' | 'ALL')}
      />
    </div>
  );
}
