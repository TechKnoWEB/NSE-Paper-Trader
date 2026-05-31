import type { Greeks } from '@/types/paper';

const TWO_PI = 2 * Math.PI;
const INV_SQRT_TWO_PI = 1 / Math.sqrt(TWO_PI);

export function normPdf(x: number): number {
  return INV_SQRT_TWO_PI * Math.exp(-0.5 * x * x);
}

export function normCdf(x: number): number {
  if (x < 0) return 1 - normCdf(-x);

  const k = 1 / (1 + 0.2316419 * x);
  const poly =
    k *
    (0.31938153 +
      k *
        (-0.356563782 +
          k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return 1 - normPdf(x) * poly;
}

export function computeD1D2(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): [number, number] {
  const logTerm = Math.log(S / K);
  const volTerm = (sigma * sigma) / 2;
  const denom = sigma * Math.sqrt(T);
  const d1 = (logTerm + (r + volTerm) * T) / denom;
  const d2 = d1 - denom;
  return [d1, d2];
}

export function computeOptionPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionType: string
): number {
  if (T <= 0) {
    const intrinsic = optionType === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
    return intrinsic;
  }

  const [d1, d2] = computeD1D2(S, K, T, r, sigma);
  const df = Math.exp(-r * T);

  if (optionType === 'CE') {
    return S * normCdf(d1) - K * df * normCdf(d2);
  }
  return K * df * normCdf(-d2) - S * normCdf(-d1);
}

export function computeGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionType: string
): Greeks {
  if (T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }

  const [d1, d2] = computeD1D2(S, K, T, r, sigma);
  const nd1 = normPdf(d1);
  const N = {
    d1: normCdf(d1),
    negD1: normCdf(-d1),
    d2: normCdf(d2),
    negD2: normCdf(-d2),
  };
  const sqrtT = Math.sqrt(T);
  const df = Math.exp(-r * T);

  let delta: number;
  if (optionType === 'CE') {
    delta = N.d1;
  } else {
    delta = N.d1 - 1;
  }

  const gamma = nd1 / (S * sigma * sqrtT);

  const thetaBase = (-S * nd1 * sigma) / (2 * sqrtT);
  let theta: number;
  if (optionType === 'CE') {
    theta = (thetaBase - r * K * df * N.d2) / 365;
  } else {
    theta = (thetaBase + r * K * df * N.negD2) / 365;
  }

  const vega = (S * nd1 * sqrtT) / 100;

  let rho: number;
  if (optionType === 'CE') {
    rho = (K * T * df * N.d2) / 100;
  } else {
    rho = (-K * T * df * N.negD2) / 100;
  }

  return { delta, gamma, theta, vega, rho };
}

export function computeIV(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  optionType: string
): number | null {
  if (T <= 0 || marketPrice <= 0) return null;

  let sigma = 0.3;
  const tol = 0.001;
  const maxIter = 100;

  for (let i = 0; i < maxIter; i++) {
    const price = computeOptionPrice(S, K, T, r, sigma, optionType);
    const diff = price - marketPrice;

    if (Math.abs(diff) < tol) return sigma;

    const vega =
      (S * normPdf(computeD1D2(S, K, T, r, sigma)[0]) * Math.sqrt(T)) / 100;
    if (Math.abs(vega) < 1e-12) return null;

    sigma = sigma - diff / vega;

    if (sigma <= 0) sigma = 0.01;
  }

  return null;
}
