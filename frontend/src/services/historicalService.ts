import apiClient from './apiClient';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getHistoricalData(
  securityId: string,
  fromDate: string,
  toDate: string,
  interval?: string
): Promise<Candle[]> {
  const { data } = await apiClient.get('/charts/historical', {
    params: {
      security_id: securityId,
      from_date: fromDate,
      to_date: toDate,
      interval,
    },
  });
  return data.candles;
}
