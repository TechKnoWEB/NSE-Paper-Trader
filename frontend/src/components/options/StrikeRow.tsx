import React from 'react';
import clsx from 'clsx';
import type { OptionStrike } from '@/types/options';
import PriceTag from '@/components/common/PriceTag';
import { formatGreek, formatLargeNumber, formatPercent } from '@/utils/formatters';
import ATMHighlight from './ATMHighlight';

interface StrikeRowProps {
  strike: OptionStrike;
  spotPrice: number;
  onSelect: (side: 'CE' | 'PE') => void;
  isAtm: boolean;
}

const cellClass = 'font-mono tabular-nums text-xs text-right px-1.5 py-0 truncate';

const GreekVal = React.memo(function GreekVal({ value, greek }: { value: number; greek: 'delta' | 'gamma' | 'theta' | 'vega' | 'rho' }) {
  const cls = value > 0 ? 'text-profit' : value < 0 ? 'text-loss' : 'text-terminal-muted';
  return <span className={cls}>{formatGreek(value, greek)}</span>;
});

function StrikeRow({ strike, spotPrice, onSelect, isAtm }: StrikeRowProps) {
  const { call, put } = strike;
  const isItmCall = strike.strike_price < spotPrice;
  const isItmPut = strike.strike_price > spotPrice;

  return (
    <ATMHighlight strikePrice={strike.strike_price} isAtm={isAtm} spotPrice={spotPrice}>
      <div
        className={clsx(
          'grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_80px_1fr_1fr_1fr_1fr_1fr_1fr] h-9 items-stretch text-xs border-b border-terminal-border/50',
          isAtm && 'bg-atm/[0.04]',
          !isAtm && 'hover:bg-terminal-surface/60'
        )}
      >
        {/* --- CE Side --- */}
        <div className={clsx(cellClass, isItmCall && 'bg-profit/[0.04]')}>{formatLargeNumber(call.oi)}</div>
        <div className={clsx(cellClass, isItmCall && 'bg-profit/[0.04]')}>{formatLargeNumber(call.volume)}</div>
        <div className={clsx(cellClass, isItmCall && 'bg-profit/[0.04]')}>{formatPercent(call.iv)}</div>
        <div className={clsx(cellClass, isItmCall && 'bg-profit/[0.04]')}><GreekVal value={call.greeks.delta} greek="delta" /></div>
        <div className={clsx(cellClass, isItmCall && 'bg-profit/[0.04]')}><GreekVal value={call.greeks.theta} greek="theta" /></div>
        <div
          className={clsx(
            cellClass,
            'cursor-pointer hover:bg-accent/10 transition-colors',
            isItmCall && 'bg-profit/[0.04] hover:bg-profit/[0.08]'
          )}
          onClick={() => onSelect('CE')}
          title={`Buy CE ${strike.strike_price}`}
        >
          <PriceTag value={call.ltp} format="ltp" />
        </div>

        {/* --- Strike --- */}
        <div
          className={clsx(
            'font-mono tabular-nums text-xs text-center flex items-center justify-center font-semibold',
            isAtm ? 'text-atm' : 'text-terminal-muted'
          )}
        >
          {strike.strike_price.toLocaleString('en-IN')}
        </div>

        {/* --- PE Side --- */}
        <div
          className={clsx(
            cellClass,
            'cursor-pointer hover:bg-accent/10 transition-colors',
            isItmPut && 'bg-loss/[0.04] hover:bg-loss/[0.08]'
          )}
          onClick={() => onSelect('PE')}
          title={`Buy PE ${strike.strike_price}`}
        >
          <PriceTag value={put.ltp} format="ltp" />
        </div>
        <div className={clsx(cellClass, isItmPut && 'bg-loss/[0.04]')}><GreekVal value={put.greeks.theta} greek="theta" /></div>
        <div className={clsx(cellClass, isItmPut && 'bg-loss/[0.04]')}><GreekVal value={put.greeks.delta} greek="delta" /></div>
        <div className={clsx(cellClass, isItmPut && 'bg-loss/[0.04]')}>{formatPercent(put.iv)}</div>
        <div className={clsx(cellClass, isItmPut && 'bg-loss/[0.04]')}>{formatLargeNumber(put.volume)}</div>
        <div className={clsx(cellClass, isItmPut && 'bg-loss/[0.04]')}>{formatLargeNumber(put.oi)}</div>
      </div>
    </ATMHighlight>
  );
}

export default React.memo(StrikeRow);
