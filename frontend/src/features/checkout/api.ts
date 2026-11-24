import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { Order } from '@/features/orders/types';

export type PaymentInfo =
  | { provider: 'fake'; confirm_url: string }
  | { provider: 'stripe'; client_secret: string; publishable_key: string | null };

/** POST /checkout: pending order with reserved keys. Same Idempotency-Key → same order. */
export function placeOrder(idempotencyKey: string) {
  return apiClient.post<{ data: Order; payment: PaymentInfo | null }>('/checkout', undefined, { headers: { 'Idempotency-Key': idempotencyKey } });
}

/** Fake gateway only (PAYMENT_DRIVER=fake). 409 when the reservation expired. */
export function confirmFakePayment(orderId: string, outcome: 'succeed' | 'fail') {
  return apiClient.post<{ data: Order }>(`/checkout/${encodeURIComponent(orderId)}/confirm`, { outcome }).then((r) => r.data);
}

export const paymentKey = (orderId: string) => ['payment', orderId] as const;

/**
 * GET /checkout/{order}/payment: the payment session of an existing order (after a reload).
 * Stripe returns the same PaymentIntent per order, so this never creates a second charge.
 */
export function usePaymentSession(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: paymentKey(orderId),
    queryFn: ({ signal }) => apiClient.get<{ data: Order; payment: PaymentInfo | null }>(`/checkout/${encodeURIComponent(orderId)}/payment`, { signal }).then((r) => r.payment),
    enabled,
    staleTime: Infinity,
  });
}
