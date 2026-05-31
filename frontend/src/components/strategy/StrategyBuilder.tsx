import React from 'react';
import { useStrategyStore } from '@/store/strategyStore';
import LegEditor from './LegEditor';
import StrategyTemplates from './StrategyTemplates';
import PayoffChart from './PayoffChart';
import ScenarioPanel from './ScenarioPanel';
import Button from '@/components/common/Button';
import type { OptionStrike } from '@/types/options';
import type { StrategyName } from '@/types/strategy';
import { formatRupee, formatGreek } from '@/utils/formatters';

interface StrategyBuilderProps {
  availableStrikes: OptionStrike[];
  currentSpot: number;
  daysToExpiry: number;
  onPaperTrade: () => void;
}

export default function StrategyBuilder({
  availableStrikes,
  currentSpot,
  daysToExpiry,
  onPaperTrade,
}: StrategyBuilderProps) {
  const {
    legs,
    underlyingPrice,
    payoffTable,
    breakevens,
    maxProfit,
    maxLoss,
    netPremium,
    netGreeks,
    scenarioSpotDelta,
    scenarioIvDelta,
    scenarioDaysDelta,
    strategyName,
    addLeg,
    removeLeg,
    updateLeg,
    setUnderlyingPrice,
    setScenario,
    setStrategyName,
    setPayoffData,
    reset,
  } = useStrategyStore();

  const estimatedMargin = legs.reduce((sum, leg) => {
    const strike = availableStrikes.find((s) => s.strike_price === leg.strike_price);
    if (!strike) return sum;
    const contract = leg.option_type === 'CE' ? strike.call : strike.put;
    return sum + (contract.ltp * leg.quantity * 100);
  }, 0);

  const estimatedPnl = (() => {
    if (!payoffTable.length) return 0;
    const scenarioSpot = currentSpot * (1 + scenarioSpotDelta / 100);
    const closest = payoffTable.reduce((prev, curr) =>
      Math.abs(curr.spot_price - scenarioSpot) < Math.abs(prev.spot_price - scenarioSpot) ? curr : prev
    );
    return closest?.pnl ?? 0;
  })();

  const scenarioDelta = scenarioSpotDelta;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <StrategyTemplates
          onSelect={(name: StrategyName) => setStrategyName(name)}
          selectedName={strategyName}
        />

        <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider">
              Legs ({legs.length}/6)
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  addLeg({
                    id: crypto.randomUUID(),
                    action: 'BUY',
                    option_type: 'CE',
                    strike_price: currentSpot,
                    expiry_date: '',
                    quantity: 1,
                  });
                }}
                disabled={legs.length >= 6}
              >
                + Add Leg
              </Button>
            </div>
          </div>

          {legs.length === 0 ? (
            <div className="py-8 text-center text-terminal-muted font-ui text-sm">
              Select a template or add legs manually
            </div>
          ) : (
            <div className="space-y-2">
              {legs.map((leg, idx) => (
                <LegEditor
                  key={leg.id}
                  leg={leg}
                  index={idx}
                  onUpdate={(updated) => updateLeg(leg.id, updated)}
                  onRemove={() => removeLeg(leg.id)}
                  availableStrikes={availableStrikes}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
          <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-3">
            Strategy Summary
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-terminal-muted font-ui uppercase">Net Premium</div>
              <div className="text-sm font-mono text-terminal-text mt-0.5">{formatRupee(netPremium)}</div>
            </div>
            <div>
              <div className="text-[10px] text-terminal-muted font-ui uppercase">Margin Req.</div>
              <div className="text-sm font-mono text-terminal-text mt-0.5">{formatRupee(estimatedMargin)}</div>
            </div>
            <div>
              <div className="text-[10px] text-terminal-muted font-ui uppercase">Delta</div>
              <div className="text-sm font-mono text-terminal-text mt-0.5">{formatGreek(netGreeks.delta, 'delta')}</div>
            </div>
            <div>
              <div className="text-[10px] text-terminal-muted font-ui uppercase">Gamma</div>
              <div className="text-sm font-mono text-terminal-text mt-0.5">{formatGreek(netGreeks.gamma, 'gamma')}</div>
            </div>
            <div>
              <div className="text-[10px] text-terminal-muted font-ui uppercase">Theta</div>
              <div className="text-sm font-mono text-terminal-text mt-0.5">{formatGreek(netGreeks.theta, 'theta')}</div>
            </div>
            <div>
              <div className="text-[10px] text-terminal-muted font-ui uppercase">Vega</div>
              <div className="text-sm font-mono text-terminal-text mt-0.5">{formatGreek(netGreeks.vega, 'vega')}</div>
            </div>
          </div>
        </div>

        <Button variant="primary" fullWidth size="lg" onClick={onPaperTrade} disabled={legs.length === 0}>
          Paper Trade Strategy
        </Button>
      </div>

      <div className="xl:col-span-3 space-y-4">
        <PayoffChart
          payoffTable={payoffTable}
          breakevens={breakevens}
          maxProfit={maxProfit}
          maxLoss={maxLoss}
          currentSpot={currentSpot}
          scenarioSpot={currentSpot * (1 + scenarioSpotDelta / 100)}
        />

        <ScenarioPanel
          currentSpot={currentSpot}
          daysToExpiry={daysToExpiry}
          estimatedPnl={estimatedPnl}
          scenarioDelta={scenarioDelta}
          onScenarioChange={(params) => setScenario(params)}
        />
      </div>
    </div>
  );
}
