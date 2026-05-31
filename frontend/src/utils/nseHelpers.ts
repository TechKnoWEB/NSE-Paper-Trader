export const LOT_SIZES: Record<string, number> = {
  NIFTY: 75,
  BANKNIFTY: 15,
  FINNIFTY: 40,
  MIDCPNIFTY: 75,
};

export function getLotSize(symbol: string): number {
  return LOT_SIZES[symbol.toUpperCase()] ?? 75;
}

export function isValidQuantity(symbol: string, quantity: number): boolean {
  const lotSize = getLotSize(symbol);
  return quantity > 0 && quantity % lotSize === 0;
}

export function strikeToSymbol(
  underlying: string,
  strike: number,
  optionType: string,
  expiry: string
): string {
  return `${underlying}-${strike}-${optionType}-${expiry.replace(/-/g, '')}`;
}

export function getNearestStrike(price: number, interval: number): number {
  return Math.round(price / interval) * interval;
}
