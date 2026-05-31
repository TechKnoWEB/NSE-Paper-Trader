export function estimateSlippage(
  ltp: number,
  strike: number,
  action: string
): number {
  const moneyness = (ltp - strike) / strike;
  const absMoneyness = Math.abs(moneyness);

  let baseBps: number;
  if (absMoneyness < 0.005) {
    baseBps = 0.5;
  } else if (absMoneyness < 0.02) {
    baseBps = 0.3;
  } else if (absMoneyness < 0.05) {
    baseBps = 0.2;
  } else {
    baseBps = 0.1;
  }

  if (action === 'SELL') baseBps *= 1.2;

  if (ltp <= 0) return 0;

  return Math.round(ltp * (baseBps / 100));
}
