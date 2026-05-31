export function formatRupee(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const parts = rupees.toFixed(0).split('');
  const lastThree = parts.splice(-3).join('');
  const rest = parts.join('');
  const formatted = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree;
  return `₹${paise < 0 ? '-' : ''}${formatted}`;
}

export function formatPnL(paise: number): string {
  const prefix = paise >= 0 ? '+' : '\u2212';
  return `${prefix}${formatRupee(Math.abs(paise))}`;
}

export function formatLTP(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function formatGreek(
  value: number,
  greek: 'delta' | 'gamma' | 'theta' | 'vega' | 'rho'
): string {
  switch (greek) {
    case 'delta':
      return value.toFixed(4);
    case 'gamma':
      return value.toFixed(4);
    case 'theta':
      return value.toFixed(2);
    case 'vega':
      return value.toFixed(2);
    case 'rho':
      return value.toFixed(2);
  }
}

export function formatLargeNumber(value: number): string {
  if (value >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (value >= 1_00_000) return `${(value / 1_00_000).toFixed(2)}L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
