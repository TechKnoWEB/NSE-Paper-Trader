import React from 'react';
import type { StrategyLeg } from '@/types/strategy';
import type { OptionStrike } from '@/types/options';
import type { OrderAction, OptionType } from '@/types/paper';
import { formatLTP, formatGreek } from '@/utils/formatters';

interface LegEditorProps {
  leg: StrategyLeg;
  index: number;
  onUpdate: (updated: StrategyLeg) => void;
  onRemove: () => void;
  availableStrikes: OptionStrike[];
}

export default function LegEditor({ leg, index, onUpdate, onRemove, availableStrikes }: LegEditorProps) {
  const contract = availableStrikes.find((s) => s.strike_price === leg.strike_price);
  const optionContract = contract
    ? leg.option_type === 'CE'
      ? contract.call
      : contract.put
    : null;

  const groupedStrikes = React.useMemo(() => {
    if (!availableStrikes.length) return { atm: [], itm: [], otm: [] };
    const center = availableStrikes.find((s) => s.is_atm)?.strike_price ?? 0;
    const atm: OptionStrike[] = [];
    const itm: OptionStrike[] = [];
    const otm: OptionStrike[] = [];
    for (const s of availableStrikes) {
      if (s.strike_price === center) atm.push(s);
      else if (leg.option_type === 'CE') {
        if (s.strike_price < center) itm.push(s);
        else otm.push(s);
      } else {
        if (s.strike_price > center) itm.push(s);
        else otm.push(s);
      }
    }
    return {
      atm: atm.slice(0, 5),
      itm: itm.slice(0, 10),
      otm: otm.slice(0, 10),
    };
  }, [availableStrikes, leg.option_type]);

  return (
    <div className="flex items-center gap-2 p-2 bg-terminal-bg rounded-lg border border-terminal-border/50 text-xs">
      <span className="text-terminal-muted font-mono w-5">#{index + 1}</span>

      <select
        value={leg.action}
        onChange={(e) => onUpdate({ ...leg, action: e.target.value as OrderAction })}
        className="bg-terminal-surface border border-terminal-border rounded px-1.5 py-1 text-terminal-text font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent/50 cursor-pointer"
      >
        <option value="BUY">BUY</option>
        <option value="SELL">SELL</option>
      </select>

      <select
        value={leg.option_type}
        onChange={(e) => onUpdate({ ...leg, option_type: e.target.value as OptionType })}
        className="bg-terminal-surface border border-terminal-border rounded px-1.5 py-1 text-terminal-text font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent/50 cursor-pointer"
      >
        <option value="CE">CE</option>
        <option value="PE">PE</option>
      </select>

      <select
        value={leg.strike_price}
        onChange={(e) => onUpdate({ ...leg, strike_price: Number(e.target.value) })}
        className="bg-terminal-surface border border-terminal-border rounded px-1.5 py-1 text-terminal-text font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent/50 cursor-pointer min-w-[80px]"
      >
        {groupedStrikes.otm.length > 0 && (
          <optgroup label="OTM">
            {groupedStrikes.otm.map((s) => (
              <option key={s.strike_price} value={s.strike_price}>
                {s.strike_price.toLocaleString('en-IN')}
              </option>
            ))}
          </optgroup>
        )}
        {groupedStrikes.atm.length > 0 && (
          <optgroup label="ATM">
            {groupedStrikes.atm.map((s) => (
              <option key={s.strike_price} value={s.strike_price}>
                {s.strike_price.toLocaleString('en-IN')}
              </option>
            ))}
          </optgroup>
        )}
        {groupedStrikes.itm.length > 0 && (
          <optgroup label="ITM">
            {groupedStrikes.itm.map((s) => (
              <option key={s.strike_price} value={s.strike_price}>
                {s.strike_price.toLocaleString('en-IN')}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <input
        type="number"
        min={1}
        max={999}
        value={leg.quantity}
        onChange={(e) => onUpdate({ ...leg, quantity: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })}
        className="bg-terminal-surface border border-terminal-border rounded px-1.5 py-1 text-terminal-text font-mono text-xs w-14 text-right focus:outline-none focus:ring-1 focus:ring-accent/50"
      />

      {optionContract && (
        <>
          <span className="font-mono text-terminal-muted w-16 text-right">{formatLTP(optionContract.ltp)}</span>
          <span className="font-mono text-terminal-muted w-12 text-right">{formatGreek(optionContract.greeks.delta, 'delta')}</span>
          <span className="font-mono text-terminal-muted w-12 text-right">{formatGreek(optionContract.greeks.theta, 'theta')}</span>
        </>
      )}

      <button
        onClick={onRemove}
        className="ml-auto p-1 text-terminal-muted hover:text-loss transition-colors cursor-pointer rounded hover:bg-loss/10"
        aria-label="Remove leg"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 5l10 10M15 5l-10 10" />
        </svg>
      </button>
    </div>
  );
}
