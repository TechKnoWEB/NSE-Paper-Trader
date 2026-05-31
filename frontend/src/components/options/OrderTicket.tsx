import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { OptionStrike } from '@/types/options';
import type { PaperOrderCreate, ChargesBreakdown, PaperOrder, OrderAction, OrderType } from '@/types/paper';
import Button from '@/components/common/Button';
import { formatLTP, formatRupee } from '@/utils/formatters';
import { toast } from '@/components/common/Toast';

interface OrderTicketProps {
  strike: OptionStrike;
  side: 'CE' | 'PE';
  lotSize?: number;
  onClose: () => void;
  onOrderPlaced?: (order: PaperOrder) => void;
}

function computeCharges(premiumValue: number, isBuy: boolean): ChargesBreakdown {
  const brokerage = 2000;
  const stt = isBuy ? 0 : Math.round(premiumValue * 0.000625);
  const exchange_charges = Math.round(premiumValue * 0.000053);
  const gst = Math.round((brokerage + exchange_charges) * 0.18);
  const stamp_duty = Math.round(premiumValue * 0.00003);
  const sebi_fee = Math.round(premiumValue * 0.000001);
  const total = brokerage + stt + exchange_charges + gst + stamp_duty + sebi_fee;
  return { brokerage, stt, exchange_charges, gst, stamp_duty, sebi_fee, total };
}

export default function OrderTicket({ strike, side, lotSize = 75, onClose, onOrderPlaced }: OrderTicketProps) {
  const [action, setAction] = useState<OrderAction>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const contract = side === 'CE' ? strike.call : strike.put;
  const ltp = contract.ltp ?? 0;
  const premiumPaise = ltp * quantity * lotSize;
  const limitPaise = orderType === 'LIMIT' && limitPrice ? Math.round(parseFloat(limitPrice) * 100) : 0;
  const effectivePremium = orderType === 'LIMIT' && limitPaise > 0 ? limitPaise * quantity * lotSize : premiumPaise;

  const isBuy = action === 'BUY';

  const charges = useMemo(() => computeCharges(effectivePremium, isBuy), [effectivePremium, isBuy]);

  const marginRequired = useMemo(() => {
    if (isBuy) {
      return effectivePremium;
    }
    const strikeValue = strike.strike_price * quantity * lotSize;
    return effectivePremium + Math.round(strikeValue * 0.10);
  }, [effectivePremium, isBuy, strike.strike_price, quantity, lotSize]);

  const marginAvailable = 10_000_000_00;
  const marginSufficient = marginRequired <= marginAvailable;

  const limitError = useMemo(() => {
    if (orderType !== 'LIMIT' || !limitPrice) return null;
    const val = parseFloat(limitPrice);
    if (isNaN(val) || val <= 0) return 'Enter a valid price';
    return null;
  }, [orderType, limitPrice]);

  const qtyError = useMemo(() => {
    if (quantity < 1 || quantity > 50) return 'Qty: 1\u201350 lots';
    return null;
  }, [quantity]);

  const canConfirm = marginSufficient && !qtyError && !limitError && (orderType === 'MARKET' || (orderType === 'LIMIT' && limitPaise > 0));

  const symbol = useMemo(() => {
    if (strike.strike_price >= 50000) return 'BANKNIFTY';
    if (strike.strike_price >= 15000) return 'NIFTY';
    return 'FINNIFTY';
  }, [strike.strike_price]);

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    setLoading(true);

    const fillPrice = orderType === 'MARKET' ? ltp : limitPaise;

    const orderCreate: PaperOrderCreate = {
      security_id: contract.security_id,
      symbol,
      underlying: symbol,
      strike_price: strike.strike_price,
      option_type: side,
      expiry_date: '2026-06-25',
      exchange_segment: 'NSE_FNO',
      action,
      order_type: orderType,
      quantity: quantity * lotSize,
      limit_price: orderType === 'LIMIT' ? limitPaise : undefined,
    };

    const mockOrder: PaperOrder = {
      ...orderCreate,
      id: `paper_${Date.now()}`,
      user_id: 'local',
      lot_size: lotSize,
      status: 'FILLED',
      fill_price: fillPrice,
      fill_timestamp: new Date().toISOString(),
      charges,
      margin_blocked: marginRequired,
      created_at: new Date().toISOString(),
    };

    setTimeout(() => {
      setLoading(false);
      toast.success(
        `${action} ${quantity} lot${quantity > 1 ? 's' : ''} ${side}`,
        `Fill: ${formatLTP(fillPrice)} | Margin: ${formatRupee(marginRequired)}`
      );
      onOrderPlaced?.(mockOrder);
      onClose();
    }, 800);
  }, [canConfirm, orderType, ltp, limitPaise, action, side, strike, quantity, lotSize, charges, marginRequired, contract.security_id, symbol, onOrderPlaced, onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const chargeRows: { label: string; value: number }[] = [
    { label: 'Brokerage', value: charges.brokerage },
    { label: 'STT', value: charges.stt },
    { label: 'Exchange', value: charges.exchange_charges },
    { label: 'GST', value: charges.gst },
    { label: 'Stamp Duty', value: charges.stamp_duty },
    { label: 'SEBI Fee', value: charges.sebi_fee },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 z-50 h-full w-[400px] bg-terminal-surface border-l border-terminal-border shadow-2xl flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <span className={clsx('font-mono text-sm font-semibold', side === 'CE' ? 'text-accent' : 'text-warning')}>
              {side}
            </span>
            <span className="font-mono text-sm text-terminal-text">
              {strike.strike_price.toLocaleString('en-IN')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-terminal-muted hover:text-terminal-text transition-colors cursor-pointer rounded hover:bg-terminal-border"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5l-10 10" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Current LTP */}
          <div className="flex items-center justify-between bg-terminal-bg rounded-lg px-4 py-3">
            <span className="text-xs text-terminal-muted font-ui">LTP</span>
            <span className="font-mono text-lg font-semibold text-terminal-text">{formatLTP(ltp)}</span>
          </div>

          {/* Action Toggle */}
          <div>
            <label className="text-xs text-terminal-muted font-ui mb-1.5 block">Action</label>
            <div className="flex rounded-lg overflow-hidden border border-terminal-border">
              <button
                onClick={() => setAction('BUY')}
                className={clsx(
                  'flex-1 py-2 text-sm font-mono font-medium transition-all cursor-pointer',
                  action === 'BUY'
                    ? 'bg-profit text-white'
                    : 'bg-terminal-bg text-terminal-muted hover:text-terminal-text'
                )}
              >
                BUY
              </button>
              <button
                onClick={() => setAction('SELL')}
                className={clsx(
                  'flex-1 py-2 text-sm font-mono font-medium transition-all cursor-pointer',
                  action === 'SELL'
                    ? 'bg-loss text-white'
                    : 'bg-terminal-bg text-terminal-muted hover:text-terminal-text'
                )}
              >
                SELL
              </button>
            </div>
          </div>

          {/* Order Type */}
          <div>
            <label className="text-xs text-terminal-muted font-ui mb-1.5 block">Order Type</label>
            <div className="flex rounded-lg overflow-hidden border border-terminal-border">
              {(['MARKET', 'LIMIT'] as OrderType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={clsx(
                    'flex-1 py-2 text-sm font-mono font-medium transition-all cursor-pointer',
                    orderType === t
                      ? 'bg-accent text-white'
                      : 'bg-terminal-bg text-terminal-muted hover:text-terminal-text'
                  )}
                >
                  {t === 'MARKET' ? 'Market' : 'Limit'}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-terminal-muted font-ui">Quantity (lots)</label>
              <span className="text-[10px] text-terminal-muted font-mono">
                1 Lot = {lotSize} units
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-terminal-border text-terminal-muted hover:text-terminal-text hover:bg-terminal-bg transition-colors cursor-pointer text-sm font-mono"
                disabled={quantity <= 1}
              >
{'\u2212'}
              </button>
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setQuantity(Math.min(50, Math.max(1, v)));
                }}
                className="flex-1 h-8 bg-terminal-bg border border-terminal-border rounded text-center font-mono text-sm text-terminal-text outline-none focus:border-accent transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-terminal-border text-terminal-muted hover:text-terminal-text hover:bg-terminal-bg transition-colors cursor-pointer text-sm font-mono"
                disabled={quantity >= 50}
              >
                +
              </button>
            </div>
            {qtyError && <p className="text-loss text-[10px] mt-1 font-mono">{qtyError}</p>}
          </div>

          {/* Limit Price */}
          {orderType === 'LIMIT' && (
            <div>
              <label className="text-xs text-terminal-muted font-ui mb-1.5 block">Limit Price ({'\u20B9'})</label>
              <input
                type="text"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={(ltp / 100).toFixed(2)}
                className="w-full h-9 bg-terminal-bg border border-terminal-border rounded px-3 font-mono text-sm text-terminal-text outline-none focus:border-accent transition-colors"
              />
              {limitError && <p className="text-loss text-[10px] mt-1 font-mono">{limitError}</p>}
            </div>
          )}

          {/* Premium Estimate */}
          <div className="bg-terminal-bg/50 rounded-lg border border-terminal-border p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-terminal-muted font-ui">Premium</span>
              <span className="font-mono text-sm text-terminal-text tabular-nums">
                {formatRupee(effectivePremium)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-terminal-muted font-ui">Per Unit</span>
              <span className="font-mono text-xs text-terminal-muted tabular-nums">
                {formatLTP(orderType === 'LIMIT' && limitPaise > 0 ? limitPaise : ltp)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-terminal-muted font-ui">Qty</span>
              <span className="font-mono text-xs text-terminal-muted tabular-nums">
                {quantity} &times; {lotSize} = {quantity * lotSize}
              </span>
            </div>
          </div>

          {/* Charges Breakdown */}
          <div>
            <span className="text-xs text-terminal-muted font-ui mb-1.5 block">Charges Estimate</span>
            <div className="bg-terminal-bg/50 rounded-lg border border-terminal-border p-3 space-y-1">
              {chargeRows.map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-terminal-muted font-mono">{r.label}</span>
                  <span className={clsx(
                    'text-[11px] font-mono tabular-nums',
                    r.value > 0 ? 'text-terminal-text' : 'text-terminal-muted'
                  )}>
                    {r.value > 0 ? formatRupee(r.value) : '\u2014'}
                  </span>
                </div>
              ))}
              <div className="border-t border-terminal-border pt-1.5 mt-1.5 flex items-center justify-between">
                <span className="text-xs text-terminal-text font-ui font-medium">Total Charges</span>
                <span className="text-xs font-mono text-terminal-text tabular-nums font-medium">
                  {formatRupee(charges.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Margin */}
          <div className="bg-terminal-bg rounded-lg border border-terminal-border p-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-terminal-muted font-ui">Margin Required</span>
                <span className={clsx(
                  'font-mono text-sm font-semibold tabular-nums',
                  marginSufficient ? 'text-profit' : 'text-loss'
                )}>
                  {formatRupee(marginRequired)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-terminal-muted font-ui">Margin Available</span>
                <span className="font-mono text-xs text-terminal-muted tabular-nums">
                  {formatRupee(marginAvailable)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-terminal-muted font-ui">Status</span>
                <span className={clsx(
                  'text-[11px] font-mono',
                  marginSufficient ? 'text-profit' : 'text-loss'
                )}>
                  {marginSufficient ? 'Sufficient' : 'Insufficient'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        <div className="shrink-0 px-5 py-4 border-t border-terminal-border">
          <Button
            variant={isBuy ? 'success' : 'danger'}
            size="lg"
            fullWidth
            loading={loading}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {loading ? 'Placing Order...' : `${action} ${quantity} Lot${quantity > 1 ? 's' : ''} ${side}`}
          </Button>
          {!marginSufficient && (
            <p className="text-loss text-[10px] text-center mt-1.5 font-mono">
              Insufficient margin: need {formatRupee(marginRequired)} but have {formatRupee(marginAvailable)}
            </p>
          )}
        </div>

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .animate-slide-in-right {
            animation: slideInRight 0.2s ease-out;
          }
        `}</style>
      </div>
    </>
  );
}
