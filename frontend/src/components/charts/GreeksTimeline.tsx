import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface GreeksTimelineProps {
  data: { daysToExpiry: number; delta: number; gamma: number; theta: number; vega: number }[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

const colors = {
  delta: '#2979FF',
  gamma: '#00C853',
  theta: '#FF3D57',
  vega: '#FFB300',
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-mono text-terminal-muted mb-1">
        DTE: {label}d
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs font-mono" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(4)}
        </p>
      ))}
    </div>
  );
};

export default function GreeksTimeline({ data }: GreeksTimelineProps) {
  if (!data.length) {
    return (
      <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
        <div className="flex items-center justify-center py-12 text-terminal-muted font-ui text-sm">
          No Greeks data available
        </div>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.daysToExpiry - a.daysToExpiry);

  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-4">
        Greeks Decay
      </span>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sorted} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis
              dataKey="daysToExpiry"
              tickFormatter={(val: number) => `${val}d`}
              tick={{ fill: '#5C6070', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: '#1E2028' }}
              tickLine={false}
              reversed
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: '#5C6070', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              width={55}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Sans', color: '#5C6070' }}
            />
            <Line
              type="monotone"
              dataKey="delta"
              stroke={colors.delta}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: colors.delta }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="gamma"
              stroke={colors.gamma}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: colors.gamma }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="theta"
              stroke={colors.theta}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: colors.theta }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="vega"
              stroke={colors.vega}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: colors.vega }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
