import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, useSettingsStore } from '@/store/settingsStore';
import apiClient from '@/services/apiClient';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import { toast } from '@/components/common/Toast';
import { formatRupee } from '@/utils/formatters';
import type { Portfolio } from '@/types/paper';

type SectionId = 'subscription' | 'capital' | 'risk' | 'display' | 'about';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'subscription', label: 'Subscription' },
  { id: 'capital', label: 'Virtual Capital' },
  { id: 'risk', label: 'Risk Preferences' },
  { id: 'display', label: 'Display Preferences' },
  { id: 'about', label: 'About' },
];

const PLANS = [
  {
    key: 'free',
    label: 'Free',
    price: 'Free',
    capital: '₹2,000',
    color: 'text-terminal-muted',
    border: 'border-terminal-border',
    popular: false,
  },
  {
    key: 'basic',
    label: 'Basic',
    price: '₹99/mo',
    capital: '₹1,00,000',
    color: 'text-profit',
    border: 'border-profit/30',
    popular: false,
  },
  {
    key: 'pro',
    label: 'Pro',
    price: '₹299/mo',
    capital: '₹50,00,000',
    color: 'text-accent',
    border: 'border-accent/40',
    popular: true,
  },
  {
    key: 'elite',
    label: 'Elite',
    price: '₹999/mo',
    capital: '₹1,00,00,000',
    color: 'text-atm',
    border: 'border-atm/40',
    popular: false,
  },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('subscription');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resettingCapital, setResettingCapital] = useState(false);

  const clearToken = useAuthStore((s) => s.clearToken);

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data } = await apiClient.get('/portfolio');
      return data as Portfolio;
    },
    refetchInterval: 30000,
  });

  const virtualCash = portfolio?.virtual_cash ?? 200000;
  const currentTier = portfolio?.subscription_tier ?? 'free';

  const {
    dailyLossLimit,
    maxLotsPerOrder,
    maxLotsPerPosition,
    maxOpenPositions,
    marginCapPct,
    stopLossPct,
    defaultIndex,
    strikesRange,
    setSetting,
  } = useSettingsStore();

  const [localDailyLoss, setLocalDailyLoss] = useState(dailyLossLimit);
  const [localMaxLotsPerOrder, setLocalMaxLotsPerOrder] = useState(maxLotsPerOrder);
  const [localMaxLotsPosition, setLocalMaxLotsPosition] = useState(maxLotsPerPosition);
  const [localMaxOpen, setLocalMaxOpen] = useState(maxOpenPositions);
  const [localMarginCap, setLocalMarginCap] = useState(marginCapPct);
  const [localStopLoss, setLocalStopLoss] = useState(stopLossPct ?? 0);

  const [localDefaultIndex, setLocalDefaultIndex] = useState(defaultIndex);
  const [localStrikesRange, setLocalStrikesRange] = useState(strikesRange);

  const handleResetCapital = async () => {
    setResettingCapital(true);
    try {
      await apiClient.post('/portfolio/reset');
      toast.success('Capital reset', `Virtual balance restored.`);
      setResetConfirmOpen(false);
      setResetText('');
    } catch {
      toast.error('Reset failed', 'Could not reset capital.');
    } finally {
      setResettingCapital(false);
    }
  };

  const saveRiskSettings = () => {
    setSetting('dailyLossLimit', localDailyLoss);
    setSetting('maxLotsPerOrder', localMaxLotsPerOrder);
    setSetting('maxLotsPerPosition', localMaxLotsPosition);
    setSetting('maxOpenPositions', localMaxOpen);
    setSetting('marginCapPct', localMarginCap);
    setSetting('stopLossPct', localStopLoss || null);
    toast.success('Risk preferences saved');
  };

  const saveDisplaySettings = () => {
    setSetting('defaultIndex', localDefaultIndex);
    setSetting('strikesRange', localStrikesRange);
    toast.success('Display preferences saved');
  };

  const sectionContent = (id: SectionId) => {
    switch (id) {
      case 'subscription':
        return (
          <div className="space-y-5">
            <h3 className="text-base font-ui text-terminal-text font-medium">Your Plan</h3>
            <p className="text-xs text-terminal-muted font-ui">
              Upgrade to unlock more virtual capital for paper trading.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {PLANS.map((plan) => {
                const isCurrent = plan.key === currentTier;
                return (
                  <div
                    key={plan.key}
                    className={`relative rounded-xl border p-4 text-center ${
                      isCurrent
                        ? `${plan.border} bg-terminal-bg`
                        : 'border-terminal-border bg-terminal-surface/50 hover:border-accent/30 transition-colors'
                    } ${plan.popular ? 'ring-1 ring-accent/30' : ''}`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-mono text-accent bg-terminal-surface px-2 rounded-full border border-accent/30">
                        Popular
                      </span>
                    )}
                    <div className={`text-xs font-mono font-semibold ${plan.color} mt-1`}>
                      {plan.label}
                    </div>
                    <div className="text-lg font-mono font-bold text-terminal-text mt-1">
                      {plan.price}
                    </div>
                    <div className="text-xs text-terminal-muted font-ui mt-1">
                      {plan.capital} capital
                    </div>
                    {isCurrent ? (
                      <div className="mt-3 text-[11px] font-mono text-profit">Current Plan</div>
                    ) : (
                      <Button
                        variant={plan.key === 'free' ? 'ghost' : 'primary'}
                        size="sm"
                        fullWidth
                        onClick={() => toast.info('Coming soon', 'Upgrades will be available shortly.')}
                        className="mt-3 text-xs"
                      >
                        {plan.key === 'free' ? 'Downgrade' : 'Upgrade'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'capital':
        return (
          <div className="space-y-5">
            <h3 className="text-base font-ui text-terminal-text font-medium">Virtual Capital</h3>
            <div className="bg-terminal-bg rounded-lg border border-terminal-border/50 p-4">
              <div className="text-[10px] text-terminal-muted font-ui uppercase tracking-wider">Current Balance</div>
              <div className="text-2xl font-mono text-terminal-text mt-1 font-bold">
                {formatRupee(virtualCash)}
              </div>
            </div>
            <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg">
              <p className="text-xs text-terminal-muted font-ui">
                Resetting will close all open positions and restore your virtual balance to the starting capital for your plan.
                This action cannot be undone.
              </p>
            </div>
            <Button variant="danger" onClick={() => setResetConfirmOpen(true)}>
              Reset Capital
            </Button>

            <Modal
              isOpen={resetConfirmOpen}
              onClose={() => { setResetConfirmOpen(false); setResetText(''); }}
              title="Confirm Capital Reset"
              size="sm"
            >
              <div className="space-y-4">
                <p className="text-sm text-terminal-muted font-ui">
                  Type <span className="font-mono text-loss font-bold">RESET</span> to confirm.
                </p>
                <input
                  type="text"
                  value={resetText}
                  onChange={(e) => setResetText(e.target.value)}
                  placeholder="type RESET"
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <div className="flex gap-2">
                  <Button variant="ghost" fullWidth onClick={() => { setResetConfirmOpen(false); setResetText(''); }}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    onClick={handleResetCapital}
                    disabled={resetText !== 'RESET'}
                    loading={resettingCapital}
                  >
                    Confirm Reset
                  </Button>
                </div>
              </div>
            </Modal>
          </div>
        );

      case 'risk':
        return (
          <div className="space-y-5">
            <h3 className="text-base font-ui text-terminal-text font-medium">Risk Preferences</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-terminal-muted font-ui mb-1.5">
                  Daily Loss Limit (paise)
                </label>
                <input
                  type="number"
                  value={localDailyLoss}
                  onChange={(e) => setLocalDailyLoss(Number(e.target.value))}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs text-terminal-muted font-ui mb-1.5">
                  Max Lots / Order
                </label>
                <input
                  type="number"
                  value={localMaxLotsPerOrder}
                  onChange={(e) => setLocalMaxLotsPerOrder(Number(e.target.value))}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs text-terminal-muted font-ui mb-1.5">
                  Max Lots / Position
                </label>
                <input
                  type="number"
                  value={localMaxLotsPosition}
                  onChange={(e) => setLocalMaxLotsPosition(Number(e.target.value))}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs text-terminal-muted font-ui mb-1.5">
                  Max Open Positions
                </label>
                <input
                  type="number"
                  value={localMaxOpen}
                  onChange={(e) => setLocalMaxOpen(Number(e.target.value))}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs text-terminal-muted font-ui mb-1.5">
                  Margin Cap %
                </label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={localMarginCap}
                  onChange={(e) => setLocalMarginCap(Number(e.target.value))}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs text-terminal-muted font-ui mb-1.5">
                  Stop-Loss % (0 = disabled)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={localStopLoss}
                  onChange={(e) => setLocalStopLoss(Number(e.target.value))}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
            <Button variant="primary" onClick={saveRiskSettings}>
              Save Risk Preferences
            </Button>
          </div>
        );

      case 'display':
        return (
          <div className="space-y-5">
            <h3 className="text-base font-ui text-terminal-text font-medium">Display Preferences</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-terminal-muted font-ui mb-1.5">Default Index</label>
                <select
                  value={localDefaultIndex}
                  onChange={(e) => setLocalDefaultIndex(e.target.value)}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="NIFTY">NIFTY</option>
                  <option value="BANKNIFTY">BANKNIFTY</option>
                  <option value="FINNIFTY">FINNIFTY</option>
                  <option value="MIDCPNIFTY">MIDCPNIFTY</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-terminal-muted font-ui mb-1.5">Strikes Range</label>
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={localStrikesRange}
                  onChange={(e) => setLocalStrikesRange(Number(e.target.value))}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-terminal-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
            <div className="p-3 bg-terminal-bg rounded-lg border border-terminal-border/50">
              <p className="text-xs text-terminal-muted font-ui">
                Theme: <span className="text-terminal-text">Dark Terminal</span> (only available theme)
              </p>
            </div>
            <Button variant="primary" onClick={saveDisplaySettings}>
              Save Display Preferences
            </Button>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-5">
            <h3 className="text-base font-ui text-terminal-text font-medium">About</h3>
            <div className="bg-terminal-bg rounded-lg border border-terminal-border/50 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-terminal-muted font-ui">App Version</span>
                <span className="text-xs font-mono text-terminal-text">1.0.0</span>
              </div>
            </div>

            <Button variant="danger" onClick={clearToken}>
              Logout
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="flex gap-6">
      <nav className="w-48 shrink-0">
        <div className="flex flex-col gap-0.5 bg-terminal-surface rounded-lg border border-terminal-border p-1.5">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`text-left px-3 py-2 text-sm font-ui rounded-md transition-colors cursor-pointer ${
                activeSection === id
                  ? 'bg-accent/10 text-accent'
                  : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-bg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 bg-terminal-surface rounded-lg border border-terminal-border p-6 min-h-[400px]">
        {sectionContent(activeSection)}
      </div>
    </div>
  );
}

