import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, buttonClasses, CoverImage, QuantityStepper, Skeleton, SkeletonText, TrashIcon } from '@/components/ui';
import { selectIsAuthenticated, useAuthStore } from '@/features/auth/authStore';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { toast } from '@/lib/toastStore';
import { cartErrorMessage, useCart, useCartActions } from './api';
import type { CartLine } from './types';

const MAX_PER_LINE = 10;

function lineProblem(line: CartLine): string | null {
  if (line.available_stock === 0) return 'Sold out or no longer offered. Remove it to continue.';
  if (line.quantity > line.available_stock) return `Only ${line.available_stock} left. Lower the quantity to continue.`;
  return null;
}

function CartItemRow({ line }: { line: CartLine }) {
  const { update, remove } = useCartActions();
  const [busy, setBusy] = useState(false);
  const problem = lineProblem(line);
  const label = `${line.product.title} (${line.product.platform.name}, ${line.product.region.name})`;

  const run = (action: () => Promise<void>) => {
    setBusy(true);
    action().then(
      () => setBusy(false),
      (error: unknown) => {
        setBusy(false);
        toast(cartErrorMessage(error), 'error');
      },
    );
  };

  return (
    <li className={cn('flex gap-15 bg-surface-card/30 p-15 transition-opacity', busy && 'opacity-60')} aria-busy={busy || undefined}>
      <Link to={`/product/${line.product.slug}`} className="block aspect-cover w-[72px] shrink-0 self-start overflow-hidden bg-surface-raised sm:w-[90px]" tabIndex={-1} aria-hidden="true">
        <CoverImage key={line.product.cover_url ?? ''} url={line.product.cover_url} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div className="flex items-start justify-between gap-10">
          <p className="text-label text-fg-secondary">Sold by <span className="text-fg-primary">{line.seller.name}</span></p>
          <button
            type="button"
            onClick={() => run(() => remove(line))}
            disabled={busy}
            aria-label={`Remove ${label}`}
            className="text-fg-secondary hover:text-fg-primary disabled:opacity-50"
          >
            <TrashIcon className="size-icon" />
          </button>
        </div>
        <Link to={`/product/${line.product.slug}`} className="text-h2-sm text-fg-primary hover:underline">
          {line.product.title}
          <span className="text-fg-secondary"> · {line.product.platform.name} · {line.product.region.name}</span>
        </Link>
        {problem ? (
          <p role="alert" className="text-body-sm text-fg-region">{problem}</p>
        ) : line.product.region.slug !== 'global' ? (
          <p className="text-body-sm text-fg-region">Region-locked key ({line.product.region.name}): check it can be activated where you are.</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-10">
          <span className="text-body-sm text-fg-muted">Digital product · instant delivery</span>
          <div className="flex items-center gap-20">
            <QuantityStepper
              value={line.quantity}
              min={1}
              max={Math.min(MAX_PER_LINE, Math.max(1, line.available_stock, line.quantity))}
              onChange={(quantity) => run(() => update(line, Math.min(quantity, Math.max(1, line.available_stock))))}
              disabled={busy || line.available_stock === 0}
              itemLabel={line.product.title}
            />
            <span className="min-w-[80px] text-right text-h2-sm text-fg-primary">{formatMoney(line.line_total_cents, line.currency)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-15 bg-canvas-header p-20" aria-hidden="true">
      <Skeleton className="h-24 w-[120px]" />
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-15 bg-surface-card/30 p-15">
          <Skeleton className="aspect-cover w-[90px]" />
          <SkeletonText lines={3} className="flex-1" />
        </div>
      ))}
    </div>
  );
}

export function CartPage() {
  const { data: cart, isPending, isError, refetch, isFetching, isPlaceholderData } = useCart();
  const isAuthenticated = useAuthStore((s) => selectIsAuthenticated(s));
  const email = useAuthStore((s) => s.user?.email);
  const navigate = useNavigate();

  if (isPending) {
    return <div className="mx-auto max-w-[1010px] px-15 py-40 xl:px-0"><CartSkeleton /></div>;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-[1010px] px-15 py-40 xl:px-0">
        <div role="alert" className="flex flex-col items-start gap-15 bg-canvas-header p-30">
          <h1 className="text-h2-sm text-fg-primary">We couldn’t load your cart</h1>
          <Button onClick={() => void refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-[1010px] px-15 py-40 xl:px-0">
        <section className="flex flex-col items-start gap-15 bg-canvas-header p-30">
          <h1 className="text-h1 text-fg-primary">Your cart is empty</h1>
          <p className="text-body text-fg-secondary">Find a game, pick the best offer, and it lands here.</p>
          <Link to="/store" className={buttonClasses('primary')}>Browse the store</Link>
        </section>
      </div>
    );
  }

  const { totals } = cart;
  const refreshing = isFetching && isPlaceholderData;

  return (
    <div className="mx-auto grid max-w-[1010px] items-start gap-20 px-15 py-40 lg:grid-cols-[1fr_355px] xl:px-0">
      <section aria-labelledby="cart-title" className="flex flex-col gap-15 bg-canvas-header p-20">
        <h1 id="cart-title" className="text-h1 text-fg-primary">My cart</h1>
        <ul className={cn('flex flex-col gap-10', refreshing && 'opacity-60')} aria-busy={refreshing || undefined}>
          {cart.items.map((line) => <CartItemRow key={line.offer_id} line={line} />)}
        </ul>
      </section>

      <div className="flex flex-col gap-20">
        <section aria-labelledby="delivery-title" className="flex flex-col gap-10 bg-canvas-header p-20">
          <h2 id="delivery-title" className="text-h2-sm text-fg-primary">Where do your keys go?</h2>
          {isAuthenticated ? (
            <p className="text-body text-fg-secondary">
              To your account{email ? <> (<strong className="text-fg-primary">{email}</strong>)</> : null}. Keys appear in Order history right after payment.
            </p>
          ) : (
            <p className="text-body text-fg-secondary">
              To your account. You’ll log in or create one at checkout; this cart comes with you.
            </p>
          )}
        </section>

        <section aria-labelledby="summary-title" className="flex flex-col gap-15 bg-canvas-header p-20 lg:sticky lg:top-20">
          <h2 id="summary-title" className="text-h2-sm text-fg-primary">Summary</h2>
          <dl className="flex flex-col gap-8 text-body">
            <div className="flex justify-between text-fg-secondary">
              <dt>{totals.items_count} {totals.items_count === 1 ? 'product' : 'products'}</dt>
              <dd>{formatMoney(totals.subtotal_cents, totals.currency)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line-subtle pt-15">
              <dt className="text-h2-sm text-fg-primary">Total:</dt>
              <dd className="text-price-xl text-fg-primary">{formatMoney(totals.subtotal_cents, totals.currency)}</dd>
            </div>
          </dl>
          <Button size="lg" fullWidth disabled={!totals.is_purchasable || refreshing} onClick={() => void navigate('/checkout')}>
            Proceed to checkout
          </Button>
          {!totals.is_purchasable && <p className="text-body-sm text-fg-region">Fix the items marked in your cart to continue.</p>}
          {!isAuthenticated && totals.is_purchasable && <p className="text-body-sm text-fg-muted">You’ll be asked to log in first.</p>}
        </section>
      </div>
    </div>
  );
}
