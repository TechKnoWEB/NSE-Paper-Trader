import React, { useState, useMemo } from 'react';
import type { Position } from '@/types/paper';
import { formatLTP, formatRupee, formatPnL, formatDate } from '@/utils/formatters';
import { getPnlClass } from '@/utils/colors';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';

type SortKey = 'symbol' | 'direction' | 'quantity' | 'avg_entry_price' | 'last_ltp' | 'unrealized_pnl' | 'margin_blocked' | 'expiry_date';

interface PositionsTableProps {
  positions: Position[];
  onClose: (id: string, qty: number) => void;
}

export default function PositionsTable({ positions, onClose }: PositionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('unrealized_pnl');
  const [sortAsc, setSortAsc] = useState(false);
  const [closeModal, setCloseModal] = useState<{ id: string; symbol: string; maxQty: number } | null>(null);
  const [closeQty, setCloseQty] = useState(0);

  const sorted = useMemo(() => {
    const arr = [...positions];
    arr.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return arr;
  }, [positions, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const [ltpFlash, setLtpFlash] = useState<Record<string, 'up' | 'down'>>({});

  const columns: { key: SortKey; label: string }[] = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'direction', label: 'Direction' },
    { key: 'quantity', label: 'Qty' },
    { key: 'avg_entry_price', label: 'Entry' },
    { key: 'last_ltp', label: 'LTP' },
    { key: 'unrealized_pnl', label: 'P&L' },
    { key: 'margin_blocked', label: 'Margin' },
    { key: 'expiry_date', label: 'Expiry' },
  ];

  const sortArrow = (key: SortKey) => {
    if (key !== sortKey) return null;
    return <span className="ml-1 text-terminal-muted text-xs">{sortAsc ? '\u25B2' : '\u25BC'}</span>;
  };

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-terminal-muted">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-40">
          <path d="M12 2v20M2 12h20" />
        </svg>
        <p className="text-lg font-ui">No open positions</p>
        <p className="text-sm mt-1">Visit Option Chain to start trading.</p>
      </div>
    );
  }

  return (
    <>
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
              <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider whitespace-nowrap">
                P&L%
              </th>
              <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider whitespace-nowrap">
                &Delta;
              </th>
              <th className="px-3 py-3 text-left text-terminal-muted font-ui text-xs uppercase tracking-wider whitespace-nowrap">
                &Theta;/day
              </th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((pos) => {
              const pnlPct = pos.avg_entry_price > 0
                ? ((pos.last_ltp - pos.avg_entry_price) / pos.avg_entry_price) * 100 * (pos.direction === 'LONG' ? 1 : -1)
                : 0;

              return (
                <tr
                  key={pos.id}
                  className="border-b border-terminal-border/50 hover:bg-terminal-surface/50 transition-colors"
                >
                  <td className="px-3 py-3 font-mono text-terminal-text whitespace-nowrap">
                    {pos.symbol}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Badge variant={pos.direction} />
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-text text-right whitespace-nowrap">
                    {pos.quantity}
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-text text-right whitespace-nowrap">
                    {formatLTP(pos.avg_entry_price)}
                  </td>
                  <td className="px-3 py-3 font-mono text-right whitespace-nowrap">
                    <span className="text-terminal-text">
                      {formatLTP(pos.last_ltp)}
                    </span>
                  </td>
                  <td className={getPnlClass(pos.unrealized_pnl) + ' px-3 py-3 font-mono text-right whitespace-nowrap'}>
                    {formatPnL(pos.unrealized_pnl)}
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-muted text-right whitespace-nowrap">
                    {formatRupee(pos.margin_blocked)}
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-muted text-right whitespace-nowrap">
                    {formatDate(pos.expiry_date)}
                  </td>
                  <td className={getPnlClass(pnlPct) + ' px-3 py-3 font-mono text-right whitespace-nowrap'}>
                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-muted text-right whitespace-nowrap">
                    {pos.greeks.delta.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 font-mono text-terminal-muted text-right whitespace-nowrap">
                    {pos.greeks.theta.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setCloseModal({ id: pos.id, symbol: pos.symbol, maxQty: pos.quantity });
                        setCloseQty(pos.quantity);
                      }}
                    >
                      Close
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={closeModal !== null}
        onClose={() => setCloseModal(null)}
        title={`Close ${closeModal?.symbol ?? ''}`}
        size="sm"
      >
        {closeModal && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-terminal-muted font-ui mb-1">
                How many lots to close?
              </label>
              <input
                type="number"
                min={1}
                max={closeModal.maxQty}
                value={closeQty}
                onChange={(e) => setCloseQty(Math.min(Math.max(1, Number(e.target.value)), closeModal.maxQty))}
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <p className="text-xs text-terminal-muted mt-1 font-ui">
                Max: {closeModal.maxQty} lots
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setCloseModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={() => {
                  onClose(closeModal.id, closeQty);
                  setCloseModal(null);
                }}
                disabled={closeQty < 1 || closeQty > closeModal.maxQty}
              >
                Close {closeQty} lot{closeQty > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
