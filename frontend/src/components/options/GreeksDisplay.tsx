import React from 'react';
import clsx from 'clsx';
import { formatGreek } from '@/utils/formatters';

interface GreeksDisplayProps {
  greeks: { delta: number; gamma: number; theta: number; vega: number; rho: number };
  quantity?: number;
  lotSize?: number;
  direction?: 'LONG' | 'SHORT';
  layout: 'inline' | 'card' | 'tooltip';
}

const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '\u2212' : '');

function GreekValue({ label, symbol, value, greekKey, isNegative }: {
  label: string;
  symbol: string;
  value: number;
  greekKey: 'delta' | 'gamma' | 'theta' | 'vega' | 'rho';
  isNegative?: boolean;
}) {
  const formatted = formatGreek(value, greekKey);
  const valClass = value > 0 ? 'text-profit' : value < 0 ? 'text-loss' : 'text-terminal-muted';
  return (
    <span className={clsx('inline-flex items-baseline gap-0.5', valClass)}>
      <span className="text-terminal-muted text-xs">{symbol}</span>
      <span className="font-mono tabular-nums">{isNegative && value > 0 ? '\u2212' : ''}{formatted}</span>
    </span>
  );
}

export default function GreeksDisplay({ greeks, quantity, lotSize, direction, layout }: GreeksDisplayProps) {
  const greeksArr: { label: string; symbol: string; key: 'delta' | 'gamma' | 'theta' | 'vega' | 'rho' }[] = [
    { label: 'Delta', symbol: '\u0394', key: 'delta' },
    { label: 'Gamma', symbol: '\u0393', key: 'gamma' },
    { label: 'Theta', symbol: '\u0398', key: 'theta' },
    { label: 'Vega', symbol: '\u03BD', key: 'vega' },
    { label: 'Rho', symbol: '\u03C1', key: 'rho' },
  ];

  const multiplier = (quantity ?? 1) * (lotSize ?? 1);
  const signedMultiplier = direction === 'SHORT' ? -multiplier : multiplier;

  if (layout === 'inline') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
        {greeksArr.map((g, i) => (
          <React.Fragment key={g.key}>
            {i > 0 && <span className="text-terminal-border mx-0.5">|</span>}
            <GreekValue label={g.label} symbol={g.symbol} value={greeks[g.key] * signedMultiplier} greekKey={g.key} />
          </React.Fragment>
        ))}
      </span>
    );
  }

  if (layout === 'tooltip') {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {greeksArr.map((g) => (
          <React.Fragment key={g.key}>
            <span className="text-terminal-muted">{g.symbol} {g.label}</span>
            <GreekValue label={g.label} symbol="" value={greeks[g.key] * signedMultiplier} greekKey={g.key} />
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-terminal-bg/50 rounded-lg border border-terminal-border p-3 space-y-1.5">
      {greeksArr.map((g) => {
        const val = greeks[g.key] * signedMultiplier;
        const valClass = val > 0 ? 'text-profit' : val < 0 ? 'text-loss' : 'text-terminal-muted';
        return (
          <div key={g.key} className="flex items-center justify-between text-xs">
            <span className="text-terminal-muted font-ui">{g.symbol} {g.label}</span>
            <span className={clsx('font-mono tabular-nums', valClass)}>
              {g.key === 'delta' || g.key === 'gamma'
                ? formatGreek(val, g.key)
                : formatGreek(val, g.key)}
            </span>
          </div>
        );
      })}
      {(quantity != null || lotSize != null) && (
        <div className="border-t border-terminal-border pt-1.5 mt-1.5 text-[10px] text-terminal-muted font-mono">
          {quantity ?? 1} lot{quantity !== 1 ? 's' : ''} &times; {lotSize ?? 1}
        </div>
      )}
    </div>
  );
}
