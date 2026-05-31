import React, { useMemo } from 'react';
import type { PayoffPoint } from '@/types/strategy';
import { formatRupee } from '@/utils/formatters';

interface PayoffChartProps {
  payoffTable: PayoffPoint[];
  breakevens: number[];
  maxProfit: number | null;
  maxLoss: number | null;
  currentSpot: number;
  scenarioSpot?: number;
}

const CHART_HEIGHT = 300;
const CHART_WIDTH = 600;
const PADDING = { top: 20, right: 20, bottom: 40, left: 60 };

export default function PayoffChart({
  payoffTable,
  breakevens,
  maxProfit,
  maxLoss,
  currentSpot,
  scenarioSpot,
}: PayoffChartProps) {
  const { points, xScale, yScale, zeroY } = useMemo(() => {
    if (!payoffTable.length) return { points: [], xScale: () => 0, yScale: () => 0, zeroY: 0 };

    const xs = payoffTable.map((p) => p.spot_price);
    const ys = payoffTable.map((p) => p.pnl);

    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys, maxLoss ?? 0, 0);
    const yMax = Math.max(...ys, maxProfit ?? 0, 0);

    const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
    const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    const xScaleFn = (v: number) => PADDING.left + ((v - xMin) / xRange) * plotW;
    const yScaleFn = (v: number) => PADDING.top + plotH - ((v - yMin) / yRange) * plotH;
    const zeroYVal = yScaleFn(0);

    const pts = payoffTable.map((p) => ({
      x: xScaleFn(p.spot_price),
      y: yScaleFn(p.pnl),
      spot: p.spot_price,
      pnl: p.pnl,
    }));

    return { points: pts, xScale: xScaleFn, yScale: yScaleFn, zeroY: zeroYVal };
  }, [payoffTable, maxProfit, maxLoss]);

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const pathD = useMemo(() => {
    if (!points.length) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }, [points]);

  const areaAbove = useMemo(() => {
    if (!points.length) return '';
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return '';
    return `${pathD} L${last.x.toFixed(1)},${zeroY.toFixed(1)} L${first.x.toFixed(1)},${zeroY.toFixed(1)} Z`;
  }, [pathD, points, zeroY]);

  const areaBelow = useMemo(() => {
    if (!points.length) return '';
    const abovePoints: string[] = [];
    let building = false;
    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[i + 1];
      if (!curr) break;
      if (!building && curr.y < zeroY) {
        if (i > 0) {
          const prev = points[i - 1];
          if (!prev) break;
          const t = (zeroY - prev.y) / (curr.y - prev.y);
          const ix = prev.x + t * (curr.x - prev.x);
          abovePoints.push(`L${ix.toFixed(1)},${zeroY.toFixed(1)}`);
        }
        building = true;
      }
      if (building) {
        abovePoints.push(`L${curr.x.toFixed(1)},${curr.y.toFixed(1)}`);
      }
      if (building && next && curr.y < zeroY && next.y >= zeroY) {
        const t = (zeroY - curr.y) / (next.y - curr.y);
        const ix = curr.x + t * (next.x - curr.x);
        abovePoints.push(`L${ix.toFixed(1)},${zeroY.toFixed(1)}`);
        building = false;
      }
    }
    if (!abovePoints.length) return '';
    const firstAbove = abovePoints[0]!;
    abovePoints[0] = firstAbove.replace('L', 'M');
    const firstPt = points.find((p) => p.y < zeroY);
    if (!firstPt) return '';
    return `${abovePoints.join(' ')} L${firstPt.x.toFixed(1)},${zeroY.toFixed(1)} Z`;
  }, [points, zeroY]);

  const xTicks = useMemo(() => {
    if (!payoffTable.length) return [];
    const step = Math.max(1, Math.floor(payoffTable.length / 8));
    return payoffTable.filter((_, i) => i % step === 0);
  }, [payoffTable]);

  const yTicks = useMemo(() => {
    if (!payoffTable.length) return [];
    const ys = payoffTable.map((p) => p.pnl);
    const yMin = Math.min(...ys, maxLoss ?? 0, 0);
    const yMax = Math.max(...ys, maxProfit ?? 0, 0);
    const range = yMax - yMin;
    const step = Math.max(1, Math.round(range / 6 / 1000) * 1000 || 1000);
    const ticks: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
      ticks.push(v);
    }
    if (!ticks.includes(0)) ticks.push(0);
    return ticks.sort((a, b) => a - b);
  }, [payoffTable, maxProfit, maxLoss]);

  if (!payoffTable.length) {
    return (
      <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
        <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-2">
          Payoff Diagram
        </span>
        <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
          <span className="text-terminal-muted font-ui text-sm">Add legs to see payoff diagram</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider">
          Payoff Diagram
        </span>
        <div className="flex gap-4 text-xs font-mono">
          {maxProfit !== null && (
            <span className="text-profit">
              Max Profit: {formatRupee(maxProfit)}
            </span>
          )}
          {maxLoss !== null && (
            <span className="text-loss">
              Max Loss: {formatRupee(maxLoss)}
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-auto"
        style={{ maxHeight: CHART_HEIGHT }}
      >
        <defs>
          <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00C853" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#00C853" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="lossFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF3D57" stopOpacity={0.02} />
            <stop offset="100%" stopColor="#FF3D57" stopOpacity={0.2} />
          </linearGradient>
        </defs>

        <g>
          {yTicks.map((v) => (
            <line
              key={`grid-${v}`}
              x1={PADDING.left}
              y1={yScale(v)}
              x2={CHART_WIDTH - PADDING.right}
              y2={yScale(v)}
              stroke="#1E2028"
              strokeWidth={1}
            />
          ))}
        </g>

        <line
          x1={PADDING.left}
          y1={zeroY}
          x2={CHART_WIDTH - PADDING.right}
          y2={zeroY}
          stroke="#5C6070"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        <path d={pathD} fill="none" stroke="#2979FF" strokeWidth={2} />

        <path d={areaAbove} fill="url(#profitFill)" />
        <path d={areaBelow} fill="url(#lossFill)" />

        {breakevens.map((be, i) => (
          <circle
            key={`be-${i}`}
            cx={xScale(be)}
            cy={zeroY}
            r={4}
            fill="#FFB300"
            stroke="#111318"
            strokeWidth={2}
          />
        ))}

        {breakevens.map((be, i) => (
          <text
            key={`bel-${i}`}
            x={xScale(be)}
            y={zeroY + 14}
            textAnchor="middle"
            fill="#FFB300"
            fontSize={10}
            fontFamily="JetBrains Mono"
          >
            BE: {be.toLocaleString('en-IN')}
          </text>
        ))}

        <line
          x1={xScale(currentSpot)}
          y1={PADDING.top}
          x2={xScale(currentSpot)}
          y2={CHART_HEIGHT - PADDING.bottom}
          stroke="#2979FF"
          strokeWidth={1.5}
          strokeDasharray="6 3"
        />
        <text
          x={xScale(currentSpot)}
          y={PADDING.top - 4}
          textAnchor="middle"
          fill="#2979FF"
          fontSize={10}
          fontFamily="JetBrains Mono"
        >
          Spot {currentSpot.toLocaleString('en-IN')}
        </text>

        {scenarioSpot && scenarioSpot !== currentSpot && (
          <>
            <line
              x1={xScale(scenarioSpot)}
              y1={PADDING.top}
              x2={xScale(scenarioSpot)}
              y2={CHART_HEIGHT - PADDING.bottom}
              stroke="#FFB300"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text
              x={xScale(scenarioSpot)}
              y={PADDING.top + 14}
              textAnchor="middle"
              fill="#FFB300"
              fontSize={10}
              fontFamily="JetBrains Mono"
            >
              Scenario
            </text>
          </>
        )}

        {xTicks.map((p, i) => (
          <text
            key={`xt-${i}`}
            x={xScale(p.spot_price)}
            y={CHART_HEIGHT - 8}
            textAnchor="middle"
            fill="#5C6070"
            fontSize={9}
            fontFamily="JetBrains Mono"
          >
            {p.spot_price.toLocaleString('en-IN')}
          </text>
        ))}

        {yTicks.map((v) => (
          <text
            key={`yt-${v}`}
            x={PADDING.left - 6}
            y={yScale(v) + 3}
            textAnchor="end"
            fill="#5C6070"
            fontSize={9}
            fontFamily="JetBrains Mono"
          >
            {v >= 0 ? '+' : ''}{formatRupee(v)}
          </text>
        ))}
      </svg>
    </div>
  );
}
