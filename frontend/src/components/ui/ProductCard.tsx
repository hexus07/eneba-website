import { useState } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { coverCandidates } from '@/lib/covers';
import { Badge } from './Badge';
import { PriceTag } from './PriceTag';
import { Skeleton, SkeletonText } from './Skeleton';
import { CartIcon } from './icons';

export interface ProductCardProps {
  href: string;
  title: string;
  coverUrl: string | null;
  platformName: string;
  regionName: string;
  /** GLOBAL keys are shown in teal, region-locked ones in pink (as on Eneba). */
  isGlobal: boolean;
  /** Cheapest offer; null = no offers right now. */
  priceCents: number | null;
  originalPriceCents?: number | null;
  currency?: string;
  /** Shows the CASHBACK tag on the cover and "N% Cashback" under the price. */
  cashbackPercent?: number | null;
  /** Hover / focus "Add to cart". Omit to hide the button (e.g. out of stock). */
  onAddToCart?: () => void;
  /** Card width follows the parent (grid/flex); `w-card` / `w-card-sm` for fixed rows. */
  className?: string;
}

export function ProductCard({
  href, title, coverUrl, platformName, regionName, isGlobal, priceCents, originalPriceCents,
  currency = 'EUR', cashbackPercent, onAddToCart, className,
}: ProductCardProps) {
  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden border border-line-card bg-surface-card',
        'transition-transform duration-200 hover:-translate-y-4 focus-within:-translate-y-4',
        className,
      )}
    >
      <div className="relative aspect-cover overflow-hidden bg-surface-raised">
        {/* key: a new coverUrl starts the fallback chain again */}
        <Cover key={coverUrl ?? ''} coverUrl={coverUrl} title={title} />
        {cashbackPercent ? <Badge variant="cashback" className="absolute bottom-platform-bar left-0" /> : null}
        <div className="absolute inset-x-0 bottom-0 flex h-platform-bar items-center justify-center bg-overlay-scrim px-10 text-label text-fg-primary backdrop-blur-scrim">
          <span className="truncate">{platformName}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-10 p-15 pb-20">
        <h3 className="line-clamp-2 min-h-[36px] text-title-card text-fg-primary">
          {/* Stretched link: the whole card is clickable, the add-to-cart button sits above it. */}
          <Link to={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        <span className={cn('text-caption uppercase', isGlobal ? 'text-success' : 'text-fg-region')}>{regionName}</span>
        {priceCents !== null ? (
          <div className="mt-auto flex flex-col gap-5">
            <PriceTag label="From" priceCents={priceCents} originalPriceCents={originalPriceCents ?? null} currency={currency} />
            {cashbackPercent ? <span className="text-label text-fg-cashback">{cashbackPercent}% Cashback</span> : null}
          </div>
        ) : (
          <span className="mt-auto text-label text-fg-muted">Out of stock</span>
        )}
      </div>

      {onAddToCart && priceCents !== null && (
        <button
          type="button"
          onClick={onAddToCart}
          className={cn(
            'absolute inset-x-0 bottom-0 z-10 flex h-control items-center justify-center gap-8 bg-accent text-button text-fg-on-accent',
            'translate-y-full transition-transform duration-200 group-hover:translate-y-0 focus-visible:translate-y-0 group-focus-within:translate-y-0',
          )}
        >
          <CartIcon className="size-icon" />
          Add to cart
          <span className="sr-only">: {title}</span>
        </button>
      )}
    </article>
  );
}

/** Tries each candidate (portrait → landscape header) on error, then a text placeholder. */
function Cover({ coverUrl, title }: { coverUrl: string | null; title: string }) {
  const candidates = coverCandidates(coverUrl);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];

  if (!src) {
    return (
      <div className="flex size-full items-center justify-center p-15 text-center text-h2-sm text-fg-tertiary" aria-hidden="true">
        {title}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setAttempt((a) => a + 1)}
      className="size-full object-cover"
    />
  );
}

/** Same footprint as ProductCard while data loads. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col border border-line-subtle bg-surface-card', className)} aria-hidden="true">
      <Skeleton className="aspect-cover w-full" />
      <div className="flex flex-col gap-10 p-15 pb-20">
        <SkeletonText lines={2} />
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="mt-10 h-24 w-1/2" />
      </div>
    </div>
  );
}
