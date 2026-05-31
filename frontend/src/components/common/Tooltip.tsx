import React, { useState, useRef, useCallback } from 'react';
import clsx from 'clsx';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const placementStyles = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowStyles = {
  top: 'top-full left-1/2 -translate-x-1/2 border-l-terminal-border border-r-transparent border-t-terminal-border border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-terminal-border border-b-terminal-border border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-terminal-border border-l-terminal-border border-r-transparent',
  right: 'right-full top-1/2 -translate-y-1/2 border-t-terminal-border border-b-transparent border-r-terminal-border border-l-transparent',
};

export default function Tooltip({ content, children, placement = 'top', delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={clsx(
            'absolute z-50 px-3 py-2 text-xs text-terminal-text bg-terminal-border rounded-lg shadow-xl whitespace-nowrap pointer-events-none',
            placementStyles[placement]
          )}
        >
          {content}
          <div className={clsx('absolute w-0 h-0 border-4', arrowStyles[placement])} />
        </div>
      )}
    </div>
  );
}
