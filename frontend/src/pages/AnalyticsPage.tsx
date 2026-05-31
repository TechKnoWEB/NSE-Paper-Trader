import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import PnLChart from '@/components/portfolio/PnLChart';
import Spinner from '@/components/common/Spinner';
import { formatRupee, formatPnL, formatPercent, formatDate } from '@/utils/formatters';
import { getPnlClass, getPnlColor } from '@/utils/colors';
import type { Trade } from '@/types/paper';

type Tab = 'overview' | 'by_strategy' | 'by_time' | 'trade_log';

interface StrategyStats {
  strategy: string;
  trades: number;
  winRate: number;
  avgPnl: number;
  best: number;
  worst: number;
}

interface DayOfWeekStat {
  day: string;
  pnl: number;
  trades: number;
  winRate: number;
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [pnlPeriod, setPnlPeriod] = useState<'7D' | '30D' | '90D' | 'ALL'>('30D');
  const [logPage, setLogPage] = useState(1);
  const logPageSize = 25;

  const { data: trades, isLoading } = useQuery({
    queryKey: ['trades', 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get('/positions/closed', { params: { limit: 10000 } });
      return data as Trade[];
    },
    staleTime: 60000,
  });

  const { data: pnlData } = useQuery({
    queryKey: ['analytics', 'pnl', pnlPeriod],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/pnl', { params: { period: pnlPeriod } });
      return data as { date: string; pnl: number }[];
    },
    staleTime: 30000,
  });

  const stats = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    const total = trades.length;
    const wins = trades.filter((t) => t.net_pnl > 0).length;
    const losses = trades.filter((t) => t.net_pnl < 0).length;
    const winRate = total > 0 ? wins / total : 0;
    const totalPnl = trades.reduce((s, t) => s + t.net_pnl, 0);
    const grossProfit = trades.filter((t) => t.net_pnl > 0).reduce((s, t) => s + t.net_pnl, 0);
    const grossLoss = Math.abs(trades.filter((t) => t.net_pnl < 0).reduce((s, t) => s + t.net_pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const avgPnl = total > 0 ? totalPnl / total : 0;
    const maxDrawdown = computeMaxDrawdown(trades);

    const byStrategy = new Map<string, Trade[]>();
    for (const t of trades) {
      const key = t.strategy_tag || 'UNKNOWN';
      if (!byStrategy.has(key)) byStrategy.set(key, []);
      byStrategy.get(key)!.push(t);
    }
    const strategyStats: StrategyStats[] = [];
    for (const [strategy, ts] of byStrategy) {
      const sWins = ts.filter((t) => t.net_pnl > 0).length;
      const sAvg = ts.reduce((s, t) => s + t.net_pnl, 0) / ts.length;
      const sBest = Math.max(...ts.map((t) => t.net_pnl));
      const sWorst = Math.min(...ts.map((t) => t.net_pnl));
      strategyStats.push({
        strategy,
        trades: ts.length,
        winRate: sWins / ts.length,
        avgPnl: sAvg,
        best: sBest,
        worst: sWorst,
      });
    }
    strategyStats.sort((a, b) => b.trades - a.trades);

    const byDay = new Map<string, { pnl: number; trades: number; wins: number }>();
    for (const t of trades) {
      const d = new Date(t.exit_timestamp);
      const day = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const cur = byDay.get(day) || { pnl: 0, trades: 0, wins: 0 };
      cur.pnl += t.net_pnl;
      cur.trades += 1;
      if (t.net_pnl > 0) cur.wins += 1;
      byDay.set(day, cur);
    }
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayStats: DayOfWeekStat[] = dayOrder.map((day) => {
      const d = byDay.get(day);
      return {
        day,
        pnl: d?.pnl ?? 0,
        trades: d?.trades ?? 0,
        winRate: d && d.trades > 0 ? d.wins / d.trades : 0,
      };
    });

    return { total, wins, losses, winRate, totalPnl, profitFactor, avgPnl, maxDrawdown, strategyStats, dayStats };
  }, [trades]);

  const filteredTrades = useMemo(() => {
    if (!trades) return [];
    const start = (logPage - 1) * logPageSize;
    return trades.slice(start, start + logPageSize);
  }, [trades, logPage]);

  const totalLogPages = trades ? Math.ceil(trades.length / logPageSize) : 0;

  const handleExportCsv = () => {
    if (!trades) return;
    const headers = ['Date', 'Symbol', 'Direction', 'Qty', 'Entry', 'Exit', 'Gross P&L', 'Charges', 'Net P&L', 'Strategy'];
    const rows = trades.map((t) => [
      formatDate(t.exit_timestamp),
      t.symbol,
      t.direction,
      t.quantity,
      (t.entry_price / 100).toFixed(2),
      (t.exit_price / 100).toFixed(2),
      (t.gross_pnl / 100).toFixed(2),
      (t.total_charges / 100).toFixed(2),
      (t.net_pnl / 100).toFixed(2),
      t.strategy_tag || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'by_strategy', label: 'By Strategy' },
    { key: 'by_time', label: 'By Time' },
    { key: 'trade_log', label: 'Trade Log' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-terminal-surface rounded-lg border border-terminal-border p-1 w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-ui rounded-md transition-colors cursor-pointer ${
              tab === key
                ? 'bg-accent text-white'
                : 'text-terminal-muted hover:text-terminal-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="space-y-4">
          <PnLChart
            data={pnlData ?? []}
            period={pnlPeriod}
            onPeriodChange={(p) => setPnlPeriod(p as typeof pnlPeriod)}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Total Trades" value={stats.total.toString()} />
            <MetricCard
              label="Win Rate"
              value={formatPercent(stats.winRate)}
              className={stats.winRate >= 0.5 ? 'text-profit' : 'text-loss'}
            />
            <MetricCard
              label="Profit Factor"
              value={stats.profitFactor === Infinity ? '\u221E' : stats.profitFactor.toFixed(2)}
            />
            <MetricCard
              label="Avg P&L"
              value={formatPnL(stats.avgPnl)}
              className={stats.avgPnl >= 0 ? 'text-profit' : 'text-loss'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
              <div className="text-[10px] text-terminal-muted font-ui uppercase tracking-wider">Total P&L</div>
              <div className={`text-2xl font-mono font-bold mt-1 ${getPnlClass(stats.totalPnl)}`}>
                {formatPnL(stats.totalPnl)}
              </div>
              <div className="flex gap-4 mt-3 text-xs font-mono">
                <span className="text-profit">Wins: {stats.wins}</span>
                <span className="text-loss">Losses: {stats.losses}</span>
              </div>
            </div>
            <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
              <div className="text-[10px] text-terminal-muted font-ui uppercase tracking-wider">Max Drawdown</div>
              <div className="text-2xl font-mono font-bold mt-1 text-loss">
                {formatPnL(stats.maxDrawdown)}
              </div>
              <div className="mt-2 w-full bg-terminal-bg rounded-full h-1.5">
                <div
                  className="bg-loss h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, Math.abs(stats.maxDrawdown) / (Math.abs(stats.totalPnl) || 1) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'overview' && !stats && (
        <div className="flex flex-col items-center justify-center py-16 text-terminal-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-40">
            <path d="M3 3v18h18" />
            <path d="M7 16l4-8 4 4 4-6" />
          </svg>
          <p className="text-lg font-ui">No analytics data yet</p>
          <p className="text-sm mt-1">Start trading to see performance metrics.</p>
        </div>
      )}

      {tab === 'by_strategy' && stats && (
        <div className="space-y-4">
          <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
            <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-4">
              Avg P&L per Strategy
            </span>
            <div className="h-64">
              <div className="flex items-end gap-3 h-full" style={{ minHeight: 200 }}>
                {stats.strategyStats.map((s) => {
                  const maxAbs = Math.max(
                    ...stats.strategyStats.map((x) => Math.abs(x.avgPnl)),
                    1
                  );
                  const pct = (s.avgPnl / maxAbs) * 100;
                  const isPositive = s.avgPnl >= 0;
                  return (
                    <div key={s.strategy} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div className="text-[10px] font-mono mb-1" style={{ color: getPnlColor(s.avgPnl) }}>
                        {formatPnL(s.avgPnl)}
                      </div>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.abs(pct)}%`,
                          backgroundColor: isPositive ? '#00C853' : '#FF3D57',
                          opacity: 0.7,
                          minHeight: 4,
                        }}
                      />
                      <div className="text-[10px] font-mono text-terminal-muted mt-1 truncate max-w-full">
                        {s.strategy}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-terminal-surface rounded-lg border border-terminal-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terminal-border">
                  <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Strategy</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Trades</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Win Rate</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Avg P&L</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Best</th>
                  <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Worst</th>
                </tr>
              </thead>
              <tbody>
                {stats.strategyStats.map((s) => (
                  <tr key={s.strategy} className="border-b border-terminal-border/50 hover:bg-terminal-bg/50 transition-colors">
                    <td className="px-3 py-3 font-mono text-terminal-text">{s.strategy}</td>
                    <td className="px-3 py-3 font-mono text-terminal-text text-right">{s.trades}</td>
                    <td className={`px-3 py-3 font-mono text-right ${s.winRate >= 0.5 ? 'text-profit' : 'text-loss'}`}>
                      {formatPercent(s.winRate)}
                    </td>
                    <td className={`px-3 py-3 font-mono text-right ${getPnlClass(s.avgPnl)}`}>
                      {formatPnL(s.avgPnl)}
                    </td>
                    <td className="px-3 py-3 font-mono text-profit text-right">{formatPnL(s.best)}</td>
                    <td className="px-3 py-3 font-mono text-loss text-right">{formatPnL(s.worst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'by_time' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
            <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-4">
              P&L by Day of Week
            </span>
            <div className="h-64">
              <div className="flex items-end gap-4 h-full" style={{ minHeight: 200 }}>
                {stats.dayStats.map((d) => {
                  const maxAbs = Math.max(...stats.dayStats.map((x) => Math.abs(x.pnl)), 1);
                  const pct = (d.pnl / maxAbs) * 100;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div className="text-[10px] font-mono mb-1" style={{ color: getPnlColor(d.pnl) }}>
                        {formatPnL(d.pnl)}
                      </div>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.abs(pct)}%`,
                          backgroundColor: d.pnl >= 0 ? '#00C853' : '#FF3D57',
                          opacity: 0.7,
                          minHeight: 4,
                        }}
                      />
                      <div className="text-[10px] font-mono text-terminal-muted mt-1">{d.day}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
            <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-4">
              Day-wise Breakdown
            </span>
            <div className="space-y-3">
              {stats.dayStats.map((d) => (
                <div key={d.day} className="flex items-center justify-between">
                  <span className="text-sm font-mono text-terminal-text w-10">{d.day}</span>
                  <span className={`text-sm font-mono ${getPnlClass(d.pnl)}`}>
                    {formatPnL(d.pnl)}
                  </span>
                  <span className="text-xs font-mono text-terminal-muted">
                    {d.trades} trades
                  </span>
                  <span className={`text-xs font-mono ${d.winRate >= 0.5 ? 'text-profit' : 'text-loss'}`}>
                    {formatPercent(d.winRate)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-terminal-bg rounded-lg border border-terminal-border/50">
              <p className="text-xs text-terminal-muted font-ui">
                {stats.dayStats.length > 0
                  ? (() => {
                      const best = stats.dayStats.reduce((a, b) => (a.pnl > b.pnl ? a : b));
                      const worst = stats.dayStats.reduce((a, b) => (a.pnl < b.pnl ? a : b));
                      return `Best trading day: ${best.day} (${formatPnL(best.pnl)}). Worst: ${worst.day} (${formatPnL(worst.pnl)}).`;
                    })()
                  : 'No data to analyse.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'by_time' && !stats && (
        <div className="flex flex-col items-center justify-center py-16 text-terminal-muted">
          <p className="text-lg font-ui">No time-based data available</p>
        </div>
      )}

      {tab === 'trade_log' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 text-xs font-mono bg-terminal-surface border border-terminal-border rounded text-terminal-muted hover:text-terminal-text cursor-pointer transition-colors"
            >
              Export CSV
            </button>
          </div>

          {trades && trades.length > 0 ? (
            <>
              <div className="bg-terminal-surface rounded-lg border border-terminal-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-terminal-border">
                      <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Date</th>
                      <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Symbol</th>
                      <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Dir</th>
                      <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Qty</th>
                      <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Entry</th>
                      <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Exit</th>
                      <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Gross P&L</th>
                      <th className="px-3 py-3 text-right text-terminal-muted font-ui text-xs uppercase tracking-wider">Net P&L</th>
                      <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider">Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map((t) => (
                      <tr key={t.id} className="border-b border-terminal-border/50 hover:bg-terminal-bg/50 transition-colors">
                        <td className="px-3 py-3 font-mono text-terminal-muted whitespace-nowrap">{formatDate(t.exit_timestamp)}</td>
                        <td className="px-3 py-3 font-mono text-terminal-text">{t.symbol}</td>
                        <td className="px-3 py-3">{t.direction === 'LONG' ? <span className="text-profit text-xs font-mono">LONG</span> : <span className="text-loss text-xs font-mono">SHORT</span>}</td>
                        <td className="px-3 py-3 font-mono text-terminal-text text-right">{t.quantity}</td>
                        <td className="px-3 py-3 font-mono text-terminal-text text-right">{(t.entry_price / 100).toFixed(2)}</td>
                        <td className="px-3 py-3 font-mono text-terminal-text text-right">{(t.exit_price / 100).toFixed(2)}</td>
                        <td className={`px-3 py-3 font-mono text-right ${getPnlClass(t.gross_pnl)}`}>{formatPnL(t.gross_pnl)}</td>
                        <td className={`px-3 py-3 font-mono text-right font-bold ${getPnlClass(t.net_pnl)}`}>{formatPnL(t.net_pnl)}</td>
                        <td className="px-3 py-3 text-xs text-terminal-muted font-mono">{t.strategy_tag || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalLogPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    disabled={logPage <= 1}
                    className="px-3 py-1.5 text-xs font-mono bg-terminal-surface border border-terminal-border rounded text-terminal-muted hover:text-terminal-text disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-xs font-mono text-terminal-muted">
                    {logPage} / {totalLogPages}
                  </span>
                  <button
                    onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                    disabled={logPage >= totalLogPages}
                    className="px-3 py-1.5 text-xs font-mono bg-terminal-surface border border-terminal-border rounded text-terminal-muted hover:text-terminal-text disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-terminal-muted">
              <p className="text-lg font-ui">No trades to display</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <div className="text-[10px] text-terminal-muted font-ui uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-mono font-bold mt-1 text-terminal-text ${className ?? ''}`}>
        {value}
      </div>
    </div>
  );
}

function computeMaxDrawdown(trades: Trade[]): number {
  let peak = 0;
  let maxDrawdown = 0;
  let running = 0;
  for (const t of trades) {
    running += t.net_pnl;
    if (running > peak) peak = running;
    const dd = running - peak;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }
  return maxDrawdown;
}
