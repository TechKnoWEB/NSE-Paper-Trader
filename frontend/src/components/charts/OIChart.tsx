import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface OIChartProps {
  data: { strike: number; callOI: number; putOI: number }[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string; fill: string }>;
  label?: number;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-mono text-terminal-muted mb-1">
        Strike: {label?.toLocaleString('en-IN')}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs font-mono" style={{ color: entry.fill }}>
          {entry.name}: {(entry.value / 100000).toFixed(1)}L
        </p>
      ))}
    </div>
  );
};

export default function OIChart({ data }: OIChartProps) {
  if (!data.length) {
    return (
      <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
        <div className="flex items-center justify-center py-12 text-terminal-muted font-ui text-sm">
          No OI data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4">
      <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider block mb-4">
        Open Interest by Strike
      </span>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis
              dataKey="strike"
              tickFormatter={(val: number) => val.toLocaleString('en-IN')}
              tick={{ fill: '#5C6070', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: '#1E2028' }}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              tickFormatter={(val: number) => `${(val / 100000).toFixed(1)}L`}
              tick={{ fill: '#5C6070', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Sans', color: '#5C6070' }}
            />
            <Bar
              dataKey="callOI"
              name="CE OI"
              fill="#2979FF"
              radius={[2, 2, 0, 0]}
              opacity={0.8}
            />
            <Bar
              dataKey="putOI"
              name="PE OI"
              fill="#FF9800"
              radius={[2, 2, 0, 0]}
              opacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
