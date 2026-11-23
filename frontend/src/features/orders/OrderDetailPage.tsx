import { Link, Navigate, useParams } from 'react-router';
import { Button, buttonClasses, CoverImage, Skeleton, SkeletonText } from '@/components/ui';
import { ApiError } from '@/lib/apiClient';
import { formatMoney } from '@/lib/money';
import { useOrder } from './api';
import { OrderKeys } from './OrderKeys';
import { isPayable, STATUS_LABEL, type Order } from './types';

const WHY: Partial<Record<Order['status'], string>> = {
  failed: 'The payment didn’t go through, so nothing was charged and the keys went back on sale.',
  expired: 'The order wasn’t paid within 15 minutes, so the reserved keys were released.',
  refunding: 'Your payment arrived after the reservation expired. A full refund is on its way.',
  refunded: 'Your payment arrived after the reservation expired and was refunded in full.',
};

/**
 * /checkout/done/:id (step 3, right after paying) and /orders/:id (from history): the order with
 * its keys. Only the owner can load it (the API returns 404 for anyone else).
 */
export function OrderDetailPage({ variant }: { variant: 'done' | 'history' }) {
  const { id = '' } = useParams();
  const { data: order, isPending, error, refetch } = useOrder(id);

  if (isPending) {
    return (
      <div className="mx-auto flex max-w-[1010px] flex-col gap-20 px-15 py-40 xl:px-0" aria-busy="true">
        <Skeleton className="h-30 w-1/2" />
        <SkeletonText lines={4} />
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="mx-auto flex max-w-[1010px] flex-col items-start gap-15 px-15 py-40 xl:px-0">
        <h1 className="text-h1 text-fg-primary">Order not found</h1>
        <Link to="/orders" className={buttonClasses('outline')}>Back to my orders</Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div role="alert" className="mx-auto flex max-w-[1010px] flex-col items-start gap-15 px-15 py-40 xl:px-0">
        <h1 className="text-h2-sm text-fg-primary">We couldn’t load this order</h1>
        <Button onClick={() => void refetch()}>Try again</Button>
      </div>
    );
  }

  // Still pending: the payment step is where this order belongs.
  if (variant === 'done' && isPayable(order)) return <Navigate to={`/checkout/pay/${order.id}`} replace />;

  const completed = order.status === 'completed';
  return (
    <div className="mx-auto flex max-w-[1010px] flex-col gap-20 px-15 py-40 xl:px-0">
      <header className="flex flex-col gap-8">
        <h1 className="text-h1 text-fg-primary">
          {completed ? (variant === 'done' ? 'Thank you! Here are your keys' : 'Your keys') : STATUS_LABEL[order.status]}
        </h1>
        <p className="text-body text-fg-secondary">
          Order <span className="font-bold text-fg-primary">#{order.id.slice(0, 8)}</span> · {new Date(order.created_at).toLocaleString('en-IE')} ·{' '}
          {formatMoney(order.total_cents, order.currency)}
        </p>
        {!completed && WHY[order.status] && <p className="text-body text-fg-secondary">{WHY[order.status]}</p>}
        {isPayable(order) && (
          <Link to={`/checkout/pay/${order.id}`} className={buttonClasses('primary', 'md')}>Continue payment</Link>
        )}
      </header>

      <ul className="flex flex-col gap-15">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-15 bg-canvas-header p-20">
            <div className="aspect-cover w-[72px] shrink-0 self-start overflow-hidden bg-surface-raised">
              <CoverImage key={item.cover_url ?? ''} url={item.cover_url} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-10">
              <div className="flex flex-wrap items-baseline justify-between gap-10">
                <h2 className="text-h2-sm text-fg-primary">
                  {item.product_slug ? <Link to={`/product/${item.product_slug}`} className="hover:underline">{item.product_title}</Link> : item.product_title}
                </h2>
                <span className="text-body text-fg-secondary">{item.quantity} × {formatMoney(item.unit_price_cents, order.currency)}</span>
              </div>
              <p className="text-body-sm text-fg-muted">{item.platform_name} · {item.region_name} · Sold by {item.seller_name}</p>
              {completed && item.keys.length > 0 && <OrderKeys productTitle={item.product_title} keys={item.keys} />}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-10">
        <Link to="/orders" className={buttonClasses('outline')}>All my orders</Link>
        <Link to="/store" className={buttonClasses('outline')}>Keep shopping</Link>
      </div>
    </div>
  );
}
