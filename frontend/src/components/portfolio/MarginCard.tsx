import React from 'react';
import clsx from 'clsx';
import { formatRupee } from '@/utils/formatters';

interface MarginCardProps {
  virtualCash: number;
  marginUsed: number;
}

export default function MarginCard({ virtualCash, marginUsed }: MarginCardProps) {
  const marginAvailable = virtualCash - marginUsed;
  const utilizationPct = virtualCash > 0 ? (marginUsed / virtualCash) * 100 : 0;

  const barColor =
    utilizationPct > 90
      ? 'bg-loss'
      : utilizationPct > 75
      ? 'bg-atm'
      : 'bg-profit';

  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-3">
        Margin
      </span>

      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <div className="text-[10px] text-terminal-muted font-ui uppercase tracking-wider">Used</div>
          <div className="text-sm font-mono text-terminal-text mt-0.5">{formatRupee(marginUsed)}</div>
        </div>
        <div>
          <div className="text-[10px] text-terminal-muted font-ui uppercase tracking-wider">Available</div>
          <div className="text-sm font-mono text-terminal-text mt-0.5">{formatRupee(marginAvailable)}</div>
        </div>
        <div>
          <div className="text-[10px] text-terminal-muted font-ui uppercase tracking-wider">Utilized</div>
          <div className={clsx('text-sm font-mono mt-0.5', utilizationPct > 75 ? 'text-atm' : 'text-terminal-text')}>
            {utilizationPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="relative w-full h-2 bg-terminal-bg rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.min(utilizationPct, 100)}%` }}
        />
      </div>

      <p className="text-[10px] text-terminal-muted mt-2 font-ui">
        Margin shown is approximate
      </p>
    </div>
  );
}
