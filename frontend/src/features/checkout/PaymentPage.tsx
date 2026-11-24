import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Button, buttonClasses, Skeleton, SkeletonText } from '@/components/ui';
import { orderKey, useOrder } from '@/features/orders/api';
import { isPayable, STATUS_LABEL, type Order } from '@/features/orders/types';
import { ApiError } from '@/lib/apiClient';
import { formatMoney } from '@/lib/money';
import { formatCountdown, useNow } from '@/lib/useNow';
import { confirmFakePayment } from './api';
import { StripePayment } from './StripePayment';

function Panel({ children }: { children: ReactNode }) {
  return <section className="mx-auto flex max-w-[560px] flex-col gap-15 bg-canvas-header p-30">{children}</section>;
}

/** Step 2b: pay a pending order before its reservation runs out. */
export function PaymentPage() {
  const { id = '' } = useParams();
  const { data: order, isPending, isError, refetch } = useOrder(id);
  const now = useNow(1000);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState<'succeed' | 'fail' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return <div className="mx-auto max-w-[560px] px-15 py-40" aria-busy="true"><Skeleton className="h-30 w-2/3" /><SkeletonText lines={3} className="mt-15" /></div>;
  }
  if (isError) {
    return (
      <div className="px-15 py-40">
        <Panel>
          <p role="alert" className="text-body text-fg-secondary">We couldn’t load this order.</p>
          <Button onClick={() => void refetch()}>Try again</Button>
        </Panel>
      </div>
    );
  }
  if (order.status === 'completed') return <Navigate to={`/checkout/done/${order.id}`} replace />;

  const remaining = order.expires_at ? new Date(order.expires_at).getTime() - now : 0;
  const payable = isPayable(order, now);

  const pay = async (outcome: 'succeed' | 'fail') => {
    setPaying(outcome);
    setError(null);
    try {
      const updated = await confirmFakePayment(order.id, outcome);
      queryClient.setQueryData(orderKey(order.id), updated);
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (updated.status === 'completed') void navigate(`/checkout/done/${order.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const expired = (e.body as { data?: Order } | null)?.data;
        if (expired) queryClient.setQueryData(orderKey(order.id), expired);
      } else {
        setError('The payment couldn’t be processed. Try again.');
      }
    } finally {
      setPaying(null);
    }
  };

  if (!payable) {
    const declined = order.status === 'failed';
    return (
      <div className="px-15 py-40">
        <Panel>
          <h1 className="text-h1 text-fg-primary">{declined ? 'Payment declined' : order.status === 'pending' ? STATUS_LABEL.expired : STATUS_LABEL[order.status]}</h1>
          <p className="text-body text-fg-secondary">
            {declined
              ? 'Nothing was charged and the reserved keys went back on sale. Your cart is still there if you want to try again.'
              : 'This order wasn’t paid within 15 minutes, so its keys were released. Check out again to reserve new ones.'}
          </p>
          <Link to="/cart" className={buttonClasses('primary')}>Back to my cart</Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="px-15 py-40">
      <Panel>
        <h1 className="text-h1 text-fg-primary">Payment</h1>
        <p className="text-body text-fg-secondary">
          Your keys are reserved for <strong className="text-accent" aria-live="off">{formatCountdown(remaining)}</strong>. Pay before the timer runs out.
        </p>
        <div className="flex items-baseline justify-between border-y border-line-subtle py-15">
          <span className="text-body text-fg-secondary">{order.items.reduce((n, i) => n + i.quantity, 0)} item(s) · #{order.id.slice(0, 8)}</span>
          <span className="text-price-xl text-fg-primary">{formatMoney(order.total_cents, order.currency)}</span>
        </div>

        {order.payment_provider === 'fake' ? (
          <>
            <p className="text-body-sm text-fg-muted">Test payment: no real money moves. Choose an outcome.</p>
            {error && <p role="alert" className="text-body-sm text-fg-region">{error}</p>}
            <Button size="lg" fullWidth loading={paying === 'succeed'} disabled={paying !== null} onClick={() => void pay('succeed')}>
              Pay {formatMoney(order.total_cents, order.currency)}
            </Button>
            <Button variant="outline" fullWidth loading={paying === 'fail'} disabled={paying !== null} onClick={() => void pay('fail')}>
              Simulate a declined payment
            </Button>
          </>
        ) : (
          <StripePayment order={order} />
        )}
      </Panel>
    </div>
  );
}
