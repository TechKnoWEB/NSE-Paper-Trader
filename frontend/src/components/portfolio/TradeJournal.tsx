import React, { useState, useMemo } from 'react';
import type { Trade } from '@/types/paper';
import { formatPnL, formatLTP, formatDate } from '@/utils/formatters';
import { getPnlClass } from '@/utils/colors';
import Badge from '@/components/common/Badge';

type SortKey = 'exit_timestamp' | 'symbol' | 'direction' | 'quantity' | 'entry_price' | 'exit_price' | 'gross_pnl' | 'total_charges' | 'net_pnl' | 'strategy_tag';

interface TradeJournalProps {
  trades: Trade[];
}

export default function TradeJournal({ trades }: TradeJournalProps) {
  const [sortKey, setSortKey] = useState<SortKey>('exit_timestamp');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...trades];
    arr.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return arr;
  }, [trades, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortArrow = (key: SortKey) => {
    if (key !== sortKey) return null;
    return <span className="ml-1 text-terminal-muted text-xs">{sortAsc ? '\u25B2' : '\u25BC'}</span>;
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: 'exit_timestamp', label: 'Date' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'direction', label: 'Dir' },
    { key: 'quantity', label: 'Qty' },
    { key: 'entry_price', label: 'Entry' },
    { key: 'exit_price', label: 'Exit' },
    { key: 'gross_pnl', label: 'Gross P&L' },
    { key: 'total_charges', label: 'Charges' },
    { key: 'net_pnl', label: 'Net P&L' },
    { key: 'strategy_tag', label: 'Strategy' },
  ];

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-terminal-muted">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-40">
          <path d="M3 12h18M5 8l7-5 7 5M19 16l-7 5-7-5M12 2v20" />
        </svg>
        <p className="text-lg font-ui">No closed trades yet</p>
        <p className="text-sm mt-1">Close a position to see it here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-terminal-border">
            {columns.map(({ key, label }) => (
              <th
                key={key}
                onClick={() => handleSort(key)}
                className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider cursor-pointer hover:text-terminal-text select-none whitespace-nowrap"
              >
                {label}
                {sortArrow(key)}
              </th>
            ))}
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((trade) => {
            const isExpanded = expandedId === trade.id;
            return (
              <React.Fragment key={trade.id}>
                <tr
                  onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                  className="border-b border-terminal-border/50 hover:bg-terminal-surface/50 transition-colors cursor-pointer"
                >
                  <td className="px-3 py-3 font-mono text-terminal-muted whitespace-nowrap">
                    {formatDate(trade.exit_timestamp)}
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-text whitespace-nowrap">
                    {trade.symbol}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Badge variant={trade.direction} />
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-text text-right whitespace-nowrap">
                    {trade.quantity}
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-text text-right whitespace-nowrap">
                    {formatLTP(trade.entry_price)}
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-text text-right whitespace-nowrap">
                    {formatLTP(trade.exit_price)}
                  </td>
                  <td className={getPnlClass(trade.gross_pnl) + ' px-3 py-3 font-mono text-right whitespace-nowrap'}>
                    {formatPnL(trade.gross_pnl)}
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-muted text-right whitespace-nowrap">
                    {formatPnL(trade.total_charges)}
                  </td>
                  <td className={getPnlClass(trade.net_pnl) + ' px-3 py-3 font-mono text-right whitespace-nowrap font-bold'}>
                    {formatPnL(trade.net_pnl)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {trade.strategy_tag ? (
                      <span className="text-xs font-mono text-terminal-muted bg-terminal-bg px-2 py-0.5 rounded">
                        {trade.strategy_tag}
                      </span>
                    ) : (
                      <span className="text-terminal-muted text-xs">--</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-terminal-muted text-xs">
                    {isExpanded ? '\u25B2' : '\u25BC'}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-terminal-bg/50">
                    <td colSpan={11} className="px-6 py-4">
                      <div className="text-xs text-terminal-muted font-ui space-y-1">
                        <p>Security ID: <span className="font-mono text-terminal-text">{trade.security_id}</span></p>
                        {trade.notes && (
                          <p>Notes: <span className="text-terminal-text">{trade.notes}</span></p>
                        )}
                        <p>
                          Entry: <span className="font-mono text-terminal-text">{formatDate(trade.entry_timestamp)}</span>
                          {' | '}Exit: <span className="font-mono text-terminal-text">{formatDate(trade.exit_timestamp)}</span>
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
