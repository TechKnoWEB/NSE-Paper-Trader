import { useMemo } from 'react';
import type { Position } from '@/types/paper';

export interface GreeksAggregate {
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  netRho: number;
}

const ZERO_GREEKS: GreeksAggregate = {
  netDelta: 0,
  netGamma: 0,
  netTheta: 0,
  netVega: 0,
  netRho: 0,
};

export function useGreeks(positions: Position[]): GreeksAggregate {
  return useMemo(() => {
    if (positions.length === 0) return ZERO_GREEKS;

    let netDelta = 0;
    let netGamma = 0;
    let netTheta = 0;
    let netVega = 0;
    let netRho = 0;

    for (const p of positions) {
      const sign = p.direction === 'LONG' ? 1 : -1;
      const factor = sign * p.quantity;
      netDelta += (p.greeks?.delta ?? 0) * factor;
      netGamma += (p.greeks?.gamma ?? 0) * factor;
      netTheta += (p.greeks?.theta ?? 0) * factor;
      netVega += (p.greeks?.vega ?? 0) * factor;
      netRho += (p.greeks?.rho ?? 0) * factor;
    }

    return { netDelta, netGamma, netTheta, netVega, netRho };
  }, [positions]);
}
