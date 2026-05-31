import apiClient from './apiClient';
import type { OptionChain } from '@/types/options';

export async function getOptionChain(
  symbol: string,
  expiry: string
): Promise<OptionChain> {
  const { data } = await apiClient.get('/option-chain', {
    params: { symbol, expiry },
  });
  return data;
}

export async function getExpiryList(symbol: string): Promise<string[]> {
  const { data } = await apiClient.get('/option-chain/expirylist', {
    params: { symbol },
  });
  return data;
}
