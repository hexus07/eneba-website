import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { Order, OrdersPage } from './types';

export const orderKey = (id: string) => ['order', id] as const;

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: ({ signal }) => apiClient.get<{ data: Order }>(`/orders/${encodeURIComponent(id)}`, { signal }).then((r) => r.data),
    // A Stripe payment completes via webhook: poll while it's pending.
    refetchInterval: (q) => (q.state.data?.status === 'pending' && q.state.data.payment_provider === 'stripe' ? 3000 : false),
  });
}

export function useOrders(page: number) {
  return useQuery({
    queryKey: ['orders', page],
    queryFn: ({ signal }) => apiClient.get<OrdersPage>(`/orders?page=${page}`, { signal }),
    placeholderData: keepPreviousData,
  });
}
