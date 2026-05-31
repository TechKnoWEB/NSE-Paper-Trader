import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { getMarketStatusColor } from '@/utils/colors';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/option-chain', label: 'Option Chain', icon: 'table' },
  { to: '/positions', label: 'Positions', icon: 'briefcase' },
  { to: '/orders', label: 'Orders', icon: 'clipboard' },
  { to: '/strategy', label: 'Strategy', icon: 'tool' },
  { to: '/analytics', label: 'Analytics', icon: 'chart' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
];

const icons: Record<string, React.ReactNode> = {
  grid: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  table: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v18H3z" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" />
    </svg>
  ),
  briefcase: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /><path d="M12 12v4" />
    </svg>
  ),
  clipboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  ),
  tool: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  chart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-6" />
    </svg>
  ),
  gear: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const { marketStatus } = useMarketStatus();

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  const statusColor = getMarketStatusColor(marketStatus);
  const statusLabel = marketStatus === 'open' ? 'Market Open' : marketStatus === 'pre_open' ? 'Pre-Open' : 'Market Closed';

  return (
    <aside
      className={clsx(
        'hidden md:flex flex-col bg-terminal-surface border-r border-terminal-border transition-all duration-200 h-screen shrink-0',
        collapsed ? 'w-16' : 'w-55'
      )}
    >
      <div className={clsx('flex items-center h-14 border-b border-terminal-border px-4 gap-3', collapsed && 'justify-center px-0')}>
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        {!collapsed && (
          <span className="font-mono text-sm font-semibold text-terminal-text tracking-wide whitespace-nowrap">NSE Paper Trader</span>
        )}
      </div>

      <nav className="flex-1 py-3 flex flex-col gap-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent border-l-2 border-accent'
                  : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-border/50',
                collapsed && 'justify-center px-0 border-l-0'
              )
            }
          >
            <span className="shrink-0">{icons[item.icon]}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={clsx('border-t border-terminal-border p-3', collapsed && 'px-0 flex justify-center')}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg text-terminal-muted hover:text-terminal-text hover:bg-terminal-border/50 transition-colors cursor-pointer"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={clsx('transition-transform', collapsed && 'rotate-180')}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className={clsx('border-t border-terminal-border p-3 flex items-center gap-2', collapsed && 'justify-center')}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
        {!collapsed && <span className="text-xs text-terminal-muted font-mono">{statusLabel}</span>}
      </div>
    </aside>
  );
}
