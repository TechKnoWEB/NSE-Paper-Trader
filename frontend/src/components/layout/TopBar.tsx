import React, { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuthStore } from '@/store/settingsStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useMarketStore } from '@/store/marketStore';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { supabase } from '@/services/supabase';
import { formatRupee } from '@/utils/formatters';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/option-chain': 'Option Chain',
  '/positions': 'Positions',
  '/orders': 'Orders',
  '/strategy': 'Strategy Builder',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/login': 'Login',
};

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = routeTitles[location.pathname] ?? 'NSE Paper Trader';
  const { istTime } = useMarketStatus();
  const virtualCash = usePortfolioStore((s) => s.virtualCash);
  const marginUsed = usePortfolioStore((s) => s.marginUsed);
  const spotPrice = useMarketStore((s) => s.spotPrice);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const clearToken = useAuthStore((s) => s.clearToken);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <header className="bg-terminal-surface border-b border-terminal-border px-4 h-14 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-base font-semibold text-terminal-text font-ui">{pageTitle}</h1>
        <div className="hidden sm:flex items-center gap-3 ml-4 pl-4 border-l border-terminal-border">
          <SymbolSearch />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-terminal-muted bg-terminal-bg rounded-lg px-3 py-1.5">
          <span className="text-terminal-text font-medium">{selectedSymbol}</span>
          <span className="text-terminal-muted">|</span>
          <span className="text-profit">
            {spotPrice > 0 ? `₹${(spotPrice / 100).toFixed(2)}` : '---'}
          </span>
        </div>

        <div className="hidden md:flex flex-col items-end text-xs font-mono">
          <span className="text-terminal-text font-medium">{formatRupee(virtualCash)}</span>
          {marginUsed > 0 && (
            <span className="text-terminal-muted">Margin: {formatRupee(marginUsed)}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono text-terminal-muted bg-terminal-bg rounded-lg px-3 py-1.5">
          <ClockIcon />
          <span>{istTime}</span>
        </div>

        <NotificationBell />

        <button
          onClick={handleLogout}
          className="p-2 text-terminal-muted hover:text-loss transition-colors cursor-pointer rounded-lg hover:bg-loss/10"
          aria-label="Logout"
          title="Logout"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const count = 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-terminal-muted hover:text-terminal-text transition-colors cursor-pointer rounded-lg hover:bg-terminal-border/50"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-loss text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-terminal-surface border border-terminal-border rounded-xl shadow-2xl z-20 py-2">
            <p className="px-4 py-3 text-xs text-terminal-muted text-center">No new notifications</p>
          </div>
        </>
      )}
    </div>
  );
}

function SymbolSearch() {
  const [query, setQuery] = useState('');
  const setSymbol = useMarketStore((s) => s.setSymbol);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  const symbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = symbols.filter((s) => s.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-terminal-bg rounded-lg px-3 py-1.5 border border-terminal-border">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5C6070" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={selectedSymbol}
          className="w-24 bg-transparent text-xs font-mono text-terminal-text outline-none placeholder:text-terminal-muted"
        />
      </div>
      {showDropdown && filtered.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-20 py-1">
          {filtered.map((s) => (
            <button
              key={s}
              className={clsx(
                'w-full text-left px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer',
                s === selectedSymbol
                  ? 'text-accent bg-accent/10'
                  : 'text-terminal-text hover:bg-terminal-border/50'
              )}
              onMouseDown={() => {
                setSymbol(s);
                setQuery('');
                setShowDropdown(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
