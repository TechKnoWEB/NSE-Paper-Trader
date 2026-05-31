import React from 'react';
import clsx from 'clsx';
import type { StrategyName } from '@/types/strategy';

interface StrategyTemplatesProps {
  onSelect: (name: StrategyName) => void;
  selectedName: StrategyName;
}

const templates: { name: StrategyName; label: string }[] = [
  { name: 'LONG_CALL', label: 'Long Call' },
  { name: 'LONG_PUT', label: 'Long Put' },
  { name: 'LONG_STRADDLE', label: 'Straddle' },
  { name: 'LONG_STRANGLE', label: 'Strangle' },
  { name: 'IRON_CONDOR', label: 'Iron Condor' },
  { name: 'BULL_CALL_SPREAD', label: 'Bull Spread' },
  { name: 'BEAR_PUT_SPREAD', label: 'Bear Spread' },
  { name: 'CUSTOM', label: 'Custom' },
];

export default function StrategyTemplates({ onSelect, selectedName }: StrategyTemplatesProps) {
  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-3">
        Strategy Templates
      </span>
      <div className="grid grid-cols-4 gap-1.5">
        {templates.map(({ name, label }) => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className={clsx(
              'px-2 py-2 text-xs font-mono rounded-lg border transition-all cursor-pointer',
              selectedName === name
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-terminal-bg border-terminal-border text-terminal-muted hover:text-terminal-text hover:border-terminal-border'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
