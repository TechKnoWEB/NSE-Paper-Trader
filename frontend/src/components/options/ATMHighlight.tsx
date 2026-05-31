import React from 'react';
import clsx from 'clsx';

interface ATMHighlightProps {
  strikePrice: number;
  isAtm: boolean;
  spotPrice: number;
  children: React.ReactNode;
}

export default function ATMHighlight({ strikePrice, isAtm, spotPrice, children }: ATMHighlightProps) {
  return (
    <div
      className={clsx(
        'relative transition-colors duration-200',
        isAtm && 'bg-atm/[0.04] ring-1 ring-inset ring-atm/20'
      )}
    >
      {isAtm && (
        <span className="absolute left-1/2 -translate-x-1/2 -top-[1px] w-12 h-[2px] bg-atm rounded-full" />
      )}
      {children}
    </div>
  );
}
