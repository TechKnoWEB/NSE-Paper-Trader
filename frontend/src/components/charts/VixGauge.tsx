import React from 'react';
import clsx from 'clsx';

interface VixGaugeProps {
  value: number;
}

export default function VixGauge({ value }: VixGaugeProps) {
  const normalized = Math.min(Math.max(value, 0), 40);
  const angle = (normalized / 40) * 180;
  const color =
    value > 20 ? '#FF3D57' : value > 15 ? '#FFB300' : '#00C853';
  const label =
    value > 20 ? 'High Vol' : value > 15 ? 'Moderate' : 'Low Vol';

  const arcEndX = 80 - 70 * Math.cos((angle * Math.PI) / 180);
  const arcEndY = 95 - 70 * Math.sin((angle * Math.PI) / 180);
  const largeArc = angle > 90 ? 1 : 0;

  return (
    <div className="bg-terminal-surface rounded-lg border border-terminal-border p-4 flex flex-col items-center">
      <span className="text-xs text-terminal-muted font-ui uppercase tracking-wider mb-2 self-start">
        India VIX
      </span>

      <svg viewBox="0 0 160 120" className="w-40 h-30">
        <defs>
          <linearGradient id="vixGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00C853" stopOpacity={0.15} />
            <stop offset="50%" stopColor="#FFB300" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#FF3D57" stopOpacity={0.15} />
          </linearGradient>
        </defs>

        <path
          d="M10,95 A70,70 0 0,1 150,95"
          fill="none"
          stroke="#1E2028"
          strokeWidth={12}
          strokeLinecap="round"
        />

        <path
          d={`M10,95 A70,70 0 0,1 ${arcEndX.toFixed(1)},${arcEndY.toFixed(1)}`}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 219.9} 219.9`}
          className="transition-all duration-500"
        />

        <path d="M80,95 L80,25" fill="none" stroke="#5C6070" strokeWidth={1} strokeDasharray="3 3" />

        {[0, 10, 20, 30, 40].map((v) => {
          const a = ((v / 40) * 180 - 90) * (Math.PI / 180);
          const textR = 60;
          const tx = 80 + textR * Math.cos(a);
          const ty = 95 + textR * Math.sin(a);
          return (
            <text
              key={v}
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#5C6070"
              fontSize={8}
              fontFamily="JetBrains Mono"
            >
              {v}
            </text>
          );
        })}

        <text
          x={80}
          y={52}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={28}
          fontFamily="JetBrains Mono"
          fontWeight="bold"
          className="transition-all duration-500"
        >
          {value.toFixed(1)}
        </text>

        {[10, 20, 30].map((v) => {
          const a = ((v / 40) * 180 - 90) * (Math.PI / 180);
          const inner = 62;
          const outer = 68;
          const x1 = 80 + inner * Math.cos(a);
          const y1 = 95 + inner * Math.sin(a);
          const x2 = 80 + outer * Math.cos(a);
          const y2 = 95 + outer * Math.sin(a);
          return (
            <line
              key={`tick-${v}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#5C6070"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      <span className={clsx('text-xs font-mono font-medium mt-1', color === '#00C853' && 'text-profit', color === '#FFB300' && 'text-atm', color === '#FF3D57' && 'text-loss')}>
        {label}
      </span>
    </div>
  );
}
