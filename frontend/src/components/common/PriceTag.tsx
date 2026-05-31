import React, { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import { formatRupee, formatLTP, formatPnL } from '@/utils/formatters';
import { getPnlColor } from '@/utils/colors';

interface PriceTagProps {
  value: number;
  previousValue?: number;
  showSign?: boolean;
  format: 'ltp' | 'pnl' | 'rupee';
  className?: string;
}

export default function PriceTag({ value, previousValue, showSign = false, format: fmt, className }: PriceTagProps) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      setFlash(value > prevRef.current ? 'up' : 'down');
      prevRef.current = value;
      const id = setTimeout(() => setFlash(null), 300);
      return () => clearTimeout(id);
    }
  }, [value]);

  let display: string;
  switch (fmt) {
    case 'ltp':
      display = formatLTP(value);
      break;
    case 'pnl':
      display = formatPnL(value);
      break;
    case 'rupee':
      display = formatRupee(value);
      break;
  }

  const hasPrev = previousValue !== undefined;
  const diff = hasPrev ? value - previousValue : 0;

  const colorClass = value === 0
    ? 'text-terminal-muted'
    : value > 0
    ? 'text-profit'
    : 'text-loss';

  const flashClass = flash === 'up' ? 'flash-profit-bg' : flash === 'down' ? 'flash-loss-bg' : '';

  return (
    <span
      className={clsx(
        'font-mono inline-flex items-center gap-1 transition-colors duration-150',
        colorClass,
        flashClass,
        className
      )}
    >
      {fmt === 'pnl' && showSign && value !== 0 && (
        <span className={clsx('text-xs', value > 0 ? 'text-profit' : 'text-loss')}>
          {value > 0 ? '\u25B2' : '\u25BC'}
        </span>
      )}
      {display}
      <style>{`
        @keyframes flashGreen { 0% { background-color: rgba(0, 200, 83, 0.3); } 100% { background-color: transparent; } }
        @keyframes flashRed { 0% { background-color: rgba(255, 61, 87, 0.3); } 100% { background-color: transparent; } }
        .flash-profit-bg { animation: flashGreen 0.3s ease-out; border-radius: 2px; }
        .flash-loss-bg { animation: flashRed 0.3s ease-out; border-radius: 2px; }
      `}</style>
    </span>
  );
}
