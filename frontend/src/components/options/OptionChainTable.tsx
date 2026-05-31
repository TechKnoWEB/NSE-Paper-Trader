import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import type { OptionChain, OptionStrike } from '@/types/options';
import StrikeRow from './StrikeRow';

interface OptionChainTableProps {
  chain: OptionChain;
  onStrikeSelect: (strike: OptionStrike, side: 'CE' | 'PE') => void;
}

const ROW_HEIGHT = 36;
const OVERSCAN = 10;

const headerLabel = 'text-[10px] text-terminal-muted font-ui text-right px-1.5 truncate select-none';

function OptionChainTable({ chain, onStrikeSelect }: OptionChainTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [showFiltered, setShowFiltered] = useState(false);
  const [staleSeconds, setStaleSeconds] = useState(chain.cache_age_seconds ?? 0);
  const [showJumpBtn, setShowJumpBtn] = useState(false);

  const atmIndex = useMemo(() => {
    return chain.strikes.findIndex((s) => s.is_atm);
  }, [chain.strikes]);

  const strikes = useMemo(() => {
    if (!showFiltered || atmIndex < 0) return chain.strikes;
    const start = Math.max(0, atmIndex - 10);
    const end = Math.min(chain.strikes.length, atmIndex + 11);
    return chain.strikes.slice(start, end);
  }, [chain.strikes, showFiltered, atmIndex]);

  const totalHeight = strikes.length * ROW_HEIGHT;

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(strikes.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
    return { start, end };
  }, [scrollTop, containerHeight, strikes.length]);

  const visibleStrikes = useMemo(() => strikes.slice(visibleRange.start, visibleRange.end), [strikes, visibleRange]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const st = e.currentTarget.scrollTop;
    setScrollTop(st);
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    const el = containerRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (containerRef.current && atmIndex >= 0) {
      const targetScroll = atmIndex * ROW_HEIGHT - containerHeight / 2 + ROW_HEIGHT / 2;
      containerRef.current.scrollTop = Math.max(0, targetScroll);
    }
  }, [atmIndex, containerHeight]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStaleSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setStaleSeconds(chain.cache_age_seconds ?? 0);
  }, [chain.cache_age_seconds]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScrollCheck = () => {
      if (atmIndex < 0) return;
      const atmTop = atmIndex * ROW_HEIGHT;
      const atmBottom = atmTop + ROW_HEIGHT;
      const viewTop = el.scrollTop;
      const viewBottom = viewTop + el.clientHeight;
      setShowJumpBtn(atmTop < viewTop || atmBottom > viewBottom);
    };
    el.addEventListener('scroll', handleScrollCheck);
    handleScrollCheck();
    return () => el.removeEventListener('scroll', handleScrollCheck);
  }, [atmIndex, strikes.length]);

  const jumpToAtm = useCallback(() => {
    if (containerRef.current && atmIndex >= 0) {
      const targetScroll = Math.max(0, atmIndex * ROW_HEIGHT - containerHeight / 2 + ROW_HEIGHT / 2);
      containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [atmIndex, containerHeight]);

  const handleStrikeSelect = useCallback(
    (strike: OptionStrike, side: 'CE' | 'PE') => {
      onStrikeSelect(strike, side);
    },
    [onStrikeSelect]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-terminal-bg border-b border-terminal-border">
        <div
          className={clsx(
            'grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_80px_1fr_1fr_1fr_1fr_1fr_1fr] h-8 items-center',
            'border-b border-terminal-border/30'
          )}
        >
          <span className={headerLabel}>OI</span>
          <span className={headerLabel}>Vol</span>
          <span className={headerLabel}>IV</span>
          <span className={headerLabel}>{'\u0394'}</span>
          <span className={headerLabel}>{'\u0398'}</span>
          <span className={headerLabel}>LTP</span>
          <span className="text-[10px] text-terminal-muted font-ui text-center truncate select-none">Strike</span>
          <span className={headerLabel}>LTP</span>
          <span className={headerLabel}>{'\u0398'}</span>
          <span className={headerLabel}>{'\u0394'}</span>
          <span className={headerLabel}>IV</span>
          <span className={headerLabel}>Vol</span>
          <span className={headerLabel}>OI</span>
        </div>
      </div>

      {/* Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${visibleRange.start * ROW_HEIGHT}px)`,
            }}
          >
            {visibleStrikes.map((s) => (
              <div key={s.strike_price} style={{ height: ROW_HEIGHT }}>
                <StrikeRow
                  strike={s}
                  spotPrice={chain.spot_price}
                  onSelect={(side) => handleStrikeSelect(s, side)}
                  isAtm={s.is_atm}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-2 py-1.5 border-t border-terminal-border bg-terminal-bg/80">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFiltered((v) => !v)}
            className={clsx(
              'text-[11px] px-2 py-0.5 rounded font-mono transition-colors cursor-pointer',
              showFiltered
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'text-terminal-muted hover:text-terminal-text border border-transparent'
            )}
          >
            {'\u00B1'}10 strikes
          </button>
          {jumpToAtm && showJumpBtn && (
            <button
              onClick={jumpToAtm}
              className="text-[11px] text-atm hover:text-atm/80 font-mono transition-colors cursor-pointer"
            >
              {'\u2191'} ATM
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-terminal-muted">
            {chain.strikes.length} strikes
          </span>
          <span
            className={clsx(
              'text-[10px] font-mono transition-colors',
              staleSeconds > 60 ? 'text-warning' : 'text-terminal-muted'
            )}
          >
            {staleSeconds}s ago
          </span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(OptionChainTable);
