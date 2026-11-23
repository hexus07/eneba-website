import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonClasses, ProductCard, ProductCardSkeleton, ScrollRow, SectionHeading, Skeleton } from '@/components/ui';
import { toCardProps } from '@/features/catalog/toCardProps';
import { useAddToCart } from '@/features/cart/api';
import { useHomeBlock } from '../api';
import type { DealsPayload, HomeLayoutBlock, ProductRowPayload } from '../types';

const CARD = 'w-card-sm shrink-0 snap-start sm:w-card';

function RowSection({ block, seeAllUrl, children }: { block: HomeLayoutBlock; seeAllUrl: string | null; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-20">
      <SectionHeading
        id={headingId}
        action={seeAllUrl ? <Link to={seeAllUrl} aria-label={`See all ${block.title}`} className={buttonClasses('outline', 'sm')}>See all</Link> : undefined}
      >
        {block.title}
      </SectionHeading>
      <ScrollRow label={block.title}>{children}</ScrollRow>
    </section>
  );
}

/** best_sellers, new_releases, by_platform: a row of product cards. */
export function ProductRowBlock({ block }: { block: HomeLayoutBlock }) {
  const { data } = useHomeBlock<ProductRowPayload>(block.key);
  if (data.items.length === 0) return null;
  return (
    <RowSection block={block} seeAllUrl={data.see_all_url}>
      {data.items.map((p) => (
        <li key={p.id} className={CARD}>
          <ProductCard {...toCardProps(p)} className="h-full" />
        </li>
      ))}
    </RowSection>
  );
}

/** deals: discounted offer per product; cards can add that offer to the cart. */
export function DealsBlock({ block }: { block: HomeLayoutBlock }) {
  const { data } = useHomeBlock<DealsPayload>(block.key);
  const addToCart = useAddToCart();
  if (data.items.length === 0) return null;
  return (
    <RowSection block={block} seeAllUrl={data.see_all_url}>
      {data.items.map((p) => (
        <li key={p.deal.offer_id} className={CARD}>
          <ProductCard
            {...toCardProps(p)}
            priceCents={p.deal.price_cents}
            originalPriceCents={p.deal.original_price_cents}
            onAddToCart={() => addToCart(p.deal.offer_id, p.title)}
            className="h-full"
          />
        </li>
      ))}
    </RowSection>
  );
}

export function ProductRowSkeleton({ block }: { block: HomeLayoutBlock }) {
  return (
    <div className="flex flex-col gap-20" aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="text-h2 text-fg-primary/40">{block.title}</span>
        <Skeleton className="h-control-sm w-[90px]" />
      </div>
      <div className="flex gap-15 overflow-hidden sm:gap-20">
        {Array.from({ length: 5 }, (_, i) => <ProductCardSkeleton key={i} className={CARD} />)}
      </div>
    </div>
  );
}
