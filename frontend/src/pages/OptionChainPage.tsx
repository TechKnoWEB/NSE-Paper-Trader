import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useOptionChain } from '@/hooks/useOptionChain';
import { useMarketStore } from '@/store/marketStore';
import OptionChainTable from '@/components/options/OptionChainTable';
import OrderTicket from '@/components/options/OrderTicket';
import Spinner from '@/components/common/Spinner';
import type { OptionStrike } from '@/types/options';

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];

export default function OptionChainPage() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const selectedExpiry = useMarketStore((s) => s.selectedExpiry);
  const setSymbol = useMarketStore((s) => s.setSymbol);
  const setExpiry = useMarketStore((s) => s.setExpiry);
  const spotPrice = useMarketStore((s) => s.spotPrice);
  const indiaVix = useMarketStore((s) => s.indiaVix);

  const [showSymbolList, setShowSymbolList] = useState(false);
  const [showExpiryList, setShowExpiryList] = useState(false);
  const [selectedStrike, setSelectedStrike] = useState<OptionStrike | null>(null);
  const [selectedSide, setSelectedSide] = useState<'CE' | 'PE' | null>(null);
  const [lastUpdatedAgo, setLastUpdatedAgo] = useState(0);

  const { data: chain, isLoading, isError, lastUpdated, expiries } = useOptionChain();

  useEffect(() => {
    if (expiries && expiries.length > 0 && !selectedExpiry) {
      const first = expiries[0];
      if (first) setExpiry(first);
    }
  }, [expiries, selectedExpiry, setExpiry]);

  useEffect(() => {
    if (lastUpdated) {
      const interval = setInterval(() => {
        setLastUpdatedAgo(Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lastUpdated]);

  const handleStrikeSelect = (strike: OptionStrike, side: 'CE' | 'PE') => {
    setSelectedStrike(strike);
    setSelectedSide(side);
  };

  const handleCloseOrderTicket = () => {
    setSelectedStrike(null);
    setSelectedSide(null);
  };

  const isStale = lastUpdatedAgo > 60;

  const vixColor = indiaVix < 14 ? 'text-profit' : indiaVix < 20 ? 'text-atm' : 'text-loss';

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <button
            onClick={() => { setShowSymbolList((v) => !v); setShowExpiryList(false); }}
            className="flex items-center gap-2 bg-terminal-surface border border-terminal-border rounded-lg px-3 h-9 text-sm font-mono text-terminal-text hover:border-accent/50 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            {selectedSymbol}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {showSymbolList && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSymbolList(false)} />
              <div className="absolute left-0 top-full mt-1 w-44 bg-terminal-surface border border-terminal-border rounded-xl shadow-2xl z-20 py-1">
                {SYMBOLS.map((sym) => (
                  <button
                    key={sym}
                    onClick={() => { setSymbol(sym); setShowSymbolList(false); }}
                    className={clsx(
                      'w-full text-left px-4 py-2 text-sm font-mono transition-colors cursor-pointer',
                      sym === selectedSymbol
                        ? 'text-accent bg-accent/10'
                        : 'text-terminal-text hover:bg-terminal-border/50'
                    )}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowExpiryList((v) => !v); setShowSymbolList(false); }}
            className="flex items-center gap-2 bg-terminal-surface border border-terminal-border rounded-lg px-3 h-9 text-sm font-mono text-terminal-text hover:border-accent/50 transition-colors cursor-pointer"
          >
            {selectedExpiry ? new Date(selectedExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select Expiry'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {showExpiryList && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExpiryList(false)} />
              <div className="absolute left-0 top-full mt-1 w-52 bg-terminal-surface border border-terminal-border rounded-xl shadow-2xl z-20 py-1 max-h-64 overflow-y-auto">
                {(expiries ?? []).map((exp) => {
                  const d = new Date(exp);
                  return (
                    <button
                      key={exp}
                      onClick={() => { setExpiry(exp); setShowExpiryList(false); }}
                      className={clsx(
                        'w-full text-left px-4 py-2 text-sm font-mono transition-colors cursor-pointer',
                        exp === selectedExpiry
                          ? 'text-accent bg-accent/10'
                          : 'text-terminal-text hover:bg-terminal-border/50'
                      )}
                    >
                      {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex-1" />

        <div className="hidden sm:flex items-center gap-2 bg-terminal-surface/50 rounded-lg px-3 py-1.5 border border-terminal-border/50">
          <span className="text-[10px] text-terminal-muted font-ui">VIX</span>
          <span className={clsx('text-sm font-mono font-medium', vixColor)}>
            {indiaVix.toFixed(2)}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-terminal-surface/50 rounded-lg px-3 py-1.5 border border-terminal-border/50">
          <span className="text-[10px] text-terminal-muted font-ui">Spot</span>
          <span className="text-lg font-mono font-bold text-terminal-text tabular-nums">
            {spotPrice > 0 ? `₹${(spotPrice / 100).toFixed(2)}` : '---'}
          </span>
        </div>

        <button
          onClick={() => setLastUpdatedAgo(0)}
          className={clsx(
            'flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-mono border transition-colors cursor-pointer',
            isStale
              ? 'text-warning border-warning/30 bg-warning/5'
              : 'text-terminal-muted border-terminal-border bg-terminal-surface hover:border-accent/50'
          )}
          title={lastUpdated ? `Last updated ${lastUpdatedAgo}s ago` : undefined}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.36 9" />
          </svg>
          {isStale ? 'Stale' : `${lastUpdatedAgo}s`}
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg/80 z-10 rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" />
              <span className="text-xs text-terminal-muted font-mono">Loading option chain...</span>
            </div>
          </div>
        )}

        {isError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg/80 z-10 rounded-lg">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-loss/20 mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF3D57" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 6v4M10 14h0" />
                </svg>
              </div>
              <p className="text-sm text-loss font-mono mb-1">Failed to load option chain</p>
              <p className="text-xs text-terminal-muted font-ui">Check your connection and try again</p>
            </div>
          </div>
        )}

        {chain && (
          <OptionChainTable
            chain={chain}
            onStrikeSelect={handleStrikeSelect}
          />
        )}

        {!chain && !isLoading && !isError && (
          <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg/80 z-10 rounded-lg">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-terminal-muted/20 mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5C6070" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M2 12h20" />
                </svg>
              </div>
              <p className="text-sm text-terminal-muted font-mono mb-1">Select a symbol and expiry</p>
              <p className="text-xs text-terminal-muted font-ui">Choose from the controls above</p>
            </div>
          </div>
        )}
      </div>

      {selectedStrike && selectedSide && (
        <OrderTicket
          strike={selectedStrike}
          side={selectedSide}
          onClose={handleCloseOrderTicket}
        />
      )}
    </div>
  );
}
