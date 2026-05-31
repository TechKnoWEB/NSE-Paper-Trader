export function getPnlColor(value: number): string {
  if (value > 0) return '#00C853';
  if (value < 0) return '#FF3D57';
  return '#5C6070';
}

export function getPnlClass(value: number): string {
  if (value > 0) return 'text-profit';
  if (value < 0) return 'text-loss';
  return 'text-terminal-muted';
}

export function getOptionTypeColor(type: string): string {
  return type === 'CE' ? '#2979FF' : '#FF9800';
}

export function getMarketStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return '#00C853';
    case 'pre_open':
      return '#FFB300';
    case 'closed':
      return '#FF3D57';
    default:
      return '#5C6070';
  }
}
