import React from 'react';
import clsx from 'clsx';
import { formatPnL } from '@/utils/formatters';

interface MTMCardProps {
  dailyPnl: number;
  totalPnl: number;
  isMarketOpen: boolean;
}

export default function MTMCard({ dailyPnl, totalPnl, isMarketOpen }: MTMCardProps) {
  const isPositive = dailyPnl >= 0;
  const isNegative = dailyPnl < 0;

  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider">
          Today&apos;s P&L
        </span>
        {!isMarketOpen && (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-terminal-muted/20 text-terminal-muted border border-terminal-border">
            EOD
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span
          className={clsx(
            'text-3xl font-mono font-bold transition-colors duration-300',
            isPositive && 'text-profit',
            isNegative && 'text-loss',
            !isPositive && !isNegative && 'text-terminal-muted'
          )}
        >
          {formatPnL(dailyPnl)}
        </span>

        {dailyPnl !== 0 && (
          <span
            className={clsx(
              'text-lg animate-pulse',
              isPositive ? 'text-profit' : 'text-loss'
            )}
          >
            {isPositive ? '\u25B2' : '\u25BC'}
          </span>
        )}
      </div>

      <div className="mt-2 text-xs font-mono">
        <span className="text-terminal-muted">All time: </span>
        <span className={dailyPnl >= 0 ? 'text-profit' : 'text-loss'}>
          {formatPnL(totalPnl)}
        </span>
      </div>
    </div>
  );
}
