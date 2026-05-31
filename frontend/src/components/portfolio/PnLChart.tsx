import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import clsx from 'clsx';

interface PnLChartProps {
  data: { date: string; pnl: number }[];
  period: '7D' | '30D' | '90D' | 'ALL';
  onPeriodChange?: (period: string) => void;
}

const periods = ['7D', '30D', '90D', 'ALL'] as const;

const formatXAxis = (val: string) => {
  const d = new Date(val);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const formatYAxis = (val: number) => {
  if (val === 0) return '0';
  const abs = Math.abs(val);
  if (abs >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${(val / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${(val / 1000).toFixed(0)}K`;
  return val.toString();
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-terminal-muted font-ui mb-1">{formatXAxis(label)}</p>
      <p className={`text-sm font-mono ${payload[0].value >= 0 ? 'text-profit' : 'text-loss'}`}>
        {payload[0].value >= 0 ? '+' : ''}₹{Math.abs(payload[0].value).toLocaleString('en-IN')}
      </p>
    </div>
  );
};

export default function PnLChart({ data, period, onPeriodChange }: PnLChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
        <div className="flex items-center justify-center py-12 text-terminal-muted font-ui text-sm">
          No P&L data available yet
        </div>
      </div>
    );
  }

  const minPnl = Math.min(...data.map((d) => d.pnl), 0);
  const maxPnl = Math.max(...data.map((d) => d.pnl), 0);
  const padding = (maxPnl - minPnl) * 0.1 || 1000;

  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider">
          P&L Over Time
        </span>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange?.(p)}
              className={clsx(
                'px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer',
                period === p
                  ? 'bg-accent text-white'
                  : 'text-terminal-muted hover:text-terminal-text bg-terminal-bg hover:bg-terminal-border'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="pnlGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00C853" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#00C853" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="pnlRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF3D57" stopOpacity={0.02} />
                <stop offset="100%" stopColor="#FF3D57" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              tick={{ fill: '#5C6070', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: '#1E2028' }}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fill: '#5C6070', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              domain={[minPnl - padding, maxPnl + padding]}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={0}
              stroke="#5C6070"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke="#2979FF"
              strokeWidth={2}
              fill="url(#pnlGreen)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: '#2979FF', stroke: '#111318', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
