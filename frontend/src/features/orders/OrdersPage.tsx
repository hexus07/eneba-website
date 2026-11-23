import { Link, useSearchParams } from 'react-router';
import { Button, buttonClasses, Pagination, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { useNow } from '@/lib/useNow';
import { useOrders } from './api';
import { isPayable, STATUS_LABEL, type OrderStatus } from './types';

const STATUS_TONE: Record<OrderStatus, string> = {
  completed: 'border-success text-success',
  pending: 'border-accent text-accent',
  refunding: 'border-line-default text-fg-secondary',
  refunded: 'border-line-default text-fg-secondary',
  failed: 'border-fg-region text-fg-region',
  expired: 'border-line-subtle text-fg-muted',
};

export function OrdersPage() {
  const [params] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isPending, isError, refetch } = useOrders(page);
  const now = useNow(30_000);

  return (
    <div className="mx-auto flex max-w-[1010px] flex-col gap-20 px-15 py-40 xl:px-0">
      <h1 className="text-h1 text-fg-primary">My orders</h1>

      {isPending ? (
        <div className="flex flex-col gap-10" aria-busy="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[88px] w-full" />)}
        </div>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-15 bg-canvas-header p-30">
          <p className="text-body text-fg-secondary">We couldn’t load your orders.</p>
          <Button onClick={() => void refetch()}>Try again</Button>
        </div>
      ) : data.data.length === 0 ? (
        <div className="flex flex-col items-start gap-15 bg-canvas-header p-30">
          <p className="text-body text-fg-secondary">No orders yet. Keys you buy appear here.</p>
          <Link to="/store" className={buttonClasses('primary')}>Browse the store</Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-10">
            {data.data.map((order) => {
              const payable = isPayable(order, now);
              const titles = order.items.map((i) => i.product_title).join(', ');
              return (
                <li key={order.id} className="flex flex-wrap items-center gap-15 bg-canvas-header p-20">
                  <div className="flex min-w-0 flex-1 flex-col gap-5">
                    <div className="flex flex-wrap items-center gap-10">
                      <span className="text-label text-fg-primary">#{order.id.slice(0, 8)}</span>
                      <span className={cn('rounded-full border px-8 py-2 text-badge', STATUS_TONE[order.status])}>
                        {order.status === 'pending' && !payable ? STATUS_LABEL.expired : STATUS_LABEL[order.status]}
                      </span>
                      <span className="text-body-sm text-fg-muted">{new Date(order.created_at).toLocaleDateString('en-IE')}</span>
                    </div>
                    <p className="truncate text-body text-fg-secondary" title={titles}>{titles}</p>
                  </div>
                  <span className="text-h2-sm text-fg-primary">{formatMoney(order.total_cents, order.currency)}</span>
                  {payable ? (
                    <Link to={`/checkout/pay/${order.id}`} className={buttonClasses('primary', 'sm')}>Continue payment</Link>
                  ) : (
                    <Link to={`/orders/${order.id}`} className={buttonClasses('outline', 'sm')}>
                      {order.status === 'completed' ? 'View keys' : 'Details'}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} hrefFor={(p) => (p > 1 ? `/orders?page=${p}` : '/orders')} />
        </>
      )}
    </div>
  );
}
