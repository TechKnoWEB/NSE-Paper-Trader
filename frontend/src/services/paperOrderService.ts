import apiClient from './apiClient';
import type { PaperOrderCreate, PaperOrder } from '@/types/paper';

export async function placePaperOrder(order: PaperOrderCreate): Promise<PaperOrder> {
  const { data } = await apiClient.post('/paper/orders', order);
  return data;
}

export async function getOrders(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: PaperOrder[]; total: number }> {
  const { data } = await apiClient.get('/paper/orders', { params });
  return data;
}

export async function cancelOrder(orderId: string): Promise<PaperOrder> {
  const { data } = await apiClient.delete(`/paper/orders/${orderId}`);
  return data;
}
