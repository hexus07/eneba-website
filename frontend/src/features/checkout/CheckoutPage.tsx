import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Button, buttonClasses, CoverImage, Skeleton } from '@/components/ui';
import { useCart } from '@/features/cart/api';
import { orderKey } from '@/features/orders/api';
import { ApiError } from '@/lib/apiClient';
import { formatMoney } from '@/lib/money';
import { placeOrder } from './api';

interface StockProblem {
  offer_id: number;
  reason: 'out_of_stock' | 'unavailable';
  requested: number;
  available: number;
}

/**
 * Step 2a: review the cart and place the order (keys get reserved for 15 minutes). One
 * Idempotency-Key per visit: a double click or a retry after a network error can't create two orders.
 */
export function CheckoutPage() {
  const { data: cart, isPending } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [placing, setPlacing] = useState(false);
  const [problems, setProblems] = useState<StockProblem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isPending) return <div className="mx-auto max-w-[1010px] px-15 py-40 xl:px-0"><Skeleton className="h-[300px] w-full" /></div>;
  if (!cart || cart.items.length === 0) return <Navigate to="/cart" replace />;

  const place = async () => {
    setPlacing(true);
    setError(null);
    try {
      const { data: order } = await placeOrder(idempotencyKey);
      queryClient.setQueryData(orderKey(order.id), order);
      void navigate(`/checkout/pay/${order.id}`);
    } catch (e) {
      setPlacing(false);
      if (e instanceof ApiError && e.status === 409) {
        setProblems((e.body as { items?: StockProblem[] } | null)?.items ?? []);
        void queryClient.invalidateQueries({ queryKey: ['cart'] });
      } else if (e instanceof ApiError && e.status === 422) {
        void navigate('/cart');
      } else {
        setError('We couldn’t place your order. Check your connection and try again: you won’t be charged twice.');
      }
    }
  };

  const titleOf = (offerId: number) => cart.items.find((l) => l.offer_id === offerId)?.product.title ?? 'An item';

  return (
    <div className="mx-auto grid max-w-[1010px] items-start gap-20 px-15 py-40 lg:grid-cols-[1fr_355px] xl:px-0">
      <section aria-labelledby="review-title" className="flex flex-col gap-15 bg-canvas-header p-20">
        <h1 id="review-title" className="text-h1 text-fg-primary">Review your order</h1>
        <ul className="flex flex-col gap-10">
          {cart.items.map((line) => (
            <li key={line.offer_id} className="flex items-center gap-15 bg-surface-card/30 p-10">
              <div className="aspect-cover w-[48px] shrink-0 overflow-hidden bg-surface-raised">
                <CoverImage key={line.product.cover_url ?? ''} url={line.product.cover_url} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-label text-fg-primary">{line.product.title}</p>
                <p className="text-body-sm text-fg-muted">{line.product.platform.name} · {line.product.region.name} · {line.seller.name}</p>
              </div>
              <span className="text-body text-fg-secondary">{line.quantity} ×</span>
              <span className="min-w-[70px] text-right text-label text-fg-primary">{formatMoney(line.line_total_cents, line.currency)}</span>
            </li>
          ))}
        </ul>
        <Link to="/cart" className="text-label text-accent hover:underline">Edit cart</Link>
      </section>

      <section aria-labelledby="pay-title" className="flex flex-col gap-15 bg-canvas-header p-20 lg:sticky lg:top-20">
        <h2 id="pay-title" className="text-h2-sm text-fg-primary">Payment</h2>
        <div className="flex items-baseline justify-between">
          <span className="text-h2-sm text-fg-primary">Total:</span>
          <span className="text-price-xl text-fg-primary">{formatMoney(cart.totals.subtotal_cents, cart.totals.currency)}</span>
        </div>
        {problems && (
          <div role="alert" className="flex flex-col gap-8 bg-surface-card p-12 text-body-sm text-fg-region">
            <p className="font-bold">Some items just sold out:</p>
            <ul className="list-disc pl-20">
              {problems.map((p) => (
                <li key={p.offer_id}>
                  {titleOf(p.offer_id)}: {p.reason === 'unavailable' ? 'no longer offered' : `${p.available} left, you wanted ${p.requested}`}
                </li>
              ))}
            </ul>
            <Link to="/cart" className={buttonClasses('outline', 'sm')}>Update my cart</Link>
          </div>
        )}
        {error && <p role="alert" className="text-body-sm text-fg-region">{error}</p>}
        <Button size="lg" fullWidth loading={placing} disabled={!cart.totals.is_purchasable || problems !== null} onClick={() => void place()}>
          Place order
        </Button>
        <p className="text-body-sm text-fg-muted">Your keys are reserved for 15 minutes while you pay.</p>
      </section>
    </div>
  );
}
