import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ScenarioParams } from '@/types/strategy';
import { formatRupee } from '@/utils/formatters';
import { getPnlClass } from '@/utils/colors';

interface ScenarioPanelProps {
  currentSpot: number;
  daysToExpiry: number;
  estimatedPnl: number;
  scenarioDelta: number;
  onScenarioChange: (params: ScenarioParams) => void;
}

export default function ScenarioPanel({
  currentSpot,
  daysToExpiry,
  estimatedPnl,
  scenarioDelta,
  onScenarioChange,
}: ScenarioPanelProps) {
  const [spotDelta, setSpotDelta] = useState(0);
  const [ivShift, setIvShift] = useState(0);
  const [daysForward, setDaysForward] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedUpdate = useCallback(
    (params: ScenarioParams) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onScenarioChange(params);
      }, 200);
    },
    [onScenarioChange]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSpotChange = (val: number) => {
    setSpotDelta(val);
    debouncedUpdate({ spot_delta_pct: val, iv_shift_pct: ivShift, days_forward: daysForward });
  };

  const handleIvChange = (val: number) => {
    setIvShift(val);
    debouncedUpdate({ spot_delta_pct: spotDelta, iv_shift_pct: val, days_forward: daysForward });
  };

  const handleDaysChange = (val: number) => {
    setDaysForward(val);
    debouncedUpdate({ spot_delta_pct: spotDelta, iv_shift_pct: ivShift, days_forward: val });
  };

  const scenarioSpot = currentSpot + currentSpot * (spotDelta / 100);
  const targetDate = daysToExpiry - daysForward;

  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-4">
        Scenario Analysis
      </span>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-ui text-terminal-muted">Spot &plusmn;%</label>
            <span className="text-xs font-mono text-terminal-text">
              {spotDelta >= 0 ? '+' : ''}{spotDelta}%
            </span>
          </div>
          <input
            type="range"
            min={-15}
            max={15}
            step={0.5}
            value={spotDelta}
            onChange={(e) => handleSpotChange(Number(e.target.value))}
            className="w-full appearance-none h-1.5 bg-terminal-bg rounded-full outline-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-terminal-muted font-mono mt-0.5">
            <span>{formatRupee(scenarioSpot)}</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-ui text-terminal-muted">IV Shift &plusmn;%</label>
            <span className="text-xs font-mono text-terminal-text">
              {ivShift >= 0 ? '+' : ''}{ivShift}%
            </span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={ivShift}
            onChange={(e) => handleIvChange(Number(e.target.value))}
            className="w-full appearance-none h-1.5 bg-terminal-bg rounded-full outline-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-ui text-terminal-muted">Days Forward</label>
            <span className="text-xs font-mono text-terminal-text">{daysForward}d</span>
          </div>
          <input
            type="range"
            min={0}
            max={daysToExpiry}
            step={1}
            value={daysForward}
            onChange={(e) => handleDaysChange(Number(e.target.value))}
            className="w-full appearance-none h-1.5 bg-terminal-bg rounded-full outline-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-terminal-muted font-mono mt-0.5">
            <span>{daysToExpiry} days to expiry</span>
            <span>{Math.max(0, targetDate)}d left</span>
          </div>
        </div>
      </div>

      <div className="mt-5 p-3 bg-terminal-bg rounded-lg border border-terminal-border/50">
        <span className="text-[10px] text-terminal-muted font-ui uppercase tracking-wider block mb-1">
          Scenario Result
        </span>
        <div className="flex items-center justify-between">
          <span className="text-sm font-ui text-terminal-muted">Est. P&L</span>
          <span className={`text-lg font-mono font-bold ${getPnlClass(estimatedPnl)}`}>
            {estimatedPnl >= 0 ? '+' : ''}{formatRupee(estimatedPnl)}
          </span>
        </div>
      </div>
    </div>
  );
}
