import { Link, useParams } from 'react-router';
import {
  Button, buttonClasses, CheckIcon, CoverImage, PriceTag, ProductCard, ProductCardSkeleton, SectionHeading, Skeleton, SkeletonText,
} from '@/components/ui';
import { useAddToCart } from '@/features/cart/api';
import { toCardProps } from '@/features/catalog/toCardProps';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { useAlsoViewed, useProduct } from './api';
import { OfferRow } from './OfferRow';
import type { ProductDetail } from './types';

const PAGE = 'mx-auto flex max-w-content flex-col gap-30 px-15 py-30 xl:px-0';

function Breadcrumbs({ product }: { product: ProductDetail }) {
  return (
    <nav aria-label="Breadcrumb" className="text-body text-fg-secondary">
      <ol className="flex flex-wrap items-center gap-8">
        <li><Link to="/" className="hover:text-accent">Home</Link></li>
        <li aria-hidden="true">›</li>
        <li><Link to="/store" className="hover:text-accent">Store</Link></li>
        <li aria-hidden="true">›</li>
        <li><Link to={`/store?platform=${encodeURIComponent(product.platform.slug)}`} className="hover:text-accent">{product.platform.name}</Link></li>
        <li aria-hidden="true">›</li>
        <li aria-current="page" className="max-w-[320px] truncate text-fg-primary">{product.title}</li>
      </ol>
    </nav>
  );
}

function Facts({ product }: { product: ProductDetail }) {
  const global = product.region.slug === 'global';
  const facts = [
    { title: product.region.name, text: global ? 'Can be activated worldwide' : `Can only be activated in ${product.region.name}`, tone: global ? 'text-success' : 'text-fg-region' },
    { title: product.platform.name, text: `Activate the key on ${product.platform.name}`, tone: 'text-success' },
    { title: 'Digital key', text: 'Instant delivery to your account after payment', tone: 'text-success' },
  ];
  return (
    <ul className="grid gap-15 sm:grid-cols-3">
      {facts.map((f) => (
        <li key={f.title} className="flex gap-10">
          <CheckIcon className={cn('size-icon-lg shrink-0', f.tone)} />
          <span className="flex flex-col">
            <strong className="text-body text-fg-primary">{f.title}</strong>
            <span className="text-body-sm text-fg-secondary">{f.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function VariantSwitcher({ product }: { product: ProductDetail }) {
  if (product.variants.length === 0) return null;
  const all = [
    { slug: product.slug, platform: product.platform, region: product.region, min_price_cents: product.offers.length > 0 ? product.min_price_cents : null, current: true },
    ...product.variants.map((v) => ({ ...v, min_price_cents: v.offers_count > 0 ? v.min_price_cents : null, current: false })),
  ];
  return (
    <section aria-labelledby="versions-title" className="flex flex-col gap-10">
      <h2 id="versions-title" className="text-label text-fg-secondary">Other versions</h2>
      <ul className="flex flex-wrap gap-10">
        {all.map((v) => (
          <li key={v.slug}>
            <Link
              to={`/product/${v.slug}`}
              aria-current={v.current ? 'page' : undefined}
              className={cn(
                'flex flex-col border px-12 py-8 text-body-sm',
                v.current ? 'border-accent text-fg-primary' : 'border-line-subtle text-fg-secondary hover:border-line-default',
              )}
            >
              <span className="font-bold text-fg-primary">{v.platform.name} · {v.region.name}</span>
              <span>{v.min_price_cents === null ? 'Out of stock' : `from ${formatMoney(v.min_price_cents, product.currency)}`}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedOffer({ product, onAdd }: { product: ProductDetail; onAdd: (offerId: number) => void }) {
  const [best] = product.offers;
  if (!best) {
    return (
      <aside aria-label="Best offer" className="flex flex-col gap-15 bg-surface-tab p-20">
        <p className="text-h2-sm text-fg-primary">Currently out of stock</p>
        <p className="text-body text-fg-secondary">
          {product.variants.some((v) => v.offers_count > 0) ? 'Another version below is available.' : 'Check back soon: sellers restock often.'}
        </p>
      </aside>
    );
  }
  const others = product.offers.length - 1;
  return (
    <aside aria-label="Best offer" className="flex flex-col gap-15 bg-surface-tab p-20 lg:sticky lg:top-20">
      <span className="text-badge text-accent uppercase">Best offer</span>
      <PriceTag size="xl" priceCents={best.price_cents} originalPriceCents={best.original_price_cents} currency={best.currency} />
      <span className="text-body-sm text-fg-secondary">Sold by <strong className="text-fg-primary">{best.seller.name}</strong> · ★ {best.seller.rating.toFixed(2)}</span>
      <Button size="lg" fullWidth onClick={() => onAdd(best.id)}>Add to cart</Button>
      {others > 0 && (
        <a href="#offers" className="text-center text-body text-accent hover:underline">
          +{others} other offer{others === 1 ? '' : 's'}
        </a>
      )}
    </aside>
  );
}

function AlsoViewed({ product }: { product: ProductDetail }) {
  const { data, isPending } = useAlsoViewed(product);
  if (product.genres.length === 0 || (!isPending && (!data || data.length === 0))) return null;
  return (
    <section aria-labelledby="also-viewed-title" className="flex flex-col gap-20">
      <SectionHeading id="also-viewed-title" size="sm">Gamers also viewed</SectionHeading>
      <ul className="grid grid-cols-2 gap-15 sm:grid-cols-3 sm:gap-20 lg:grid-cols-5">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => <li key={i}><ProductCardSkeleton /></li>)
          : data.map((p) => <li key={p.id}><ProductCard {...toCardProps(p)} className="h-full" /></li>)}
      </ul>
    </section>
  );
}

function ProductSkeleton() {
  return (
    <div className={PAGE} aria-busy="true">
      <Skeleton className="h-20 w-1/3" />
      <div className="grid gap-30 lg:grid-cols-[224px_1fr_350px]">
        <Skeleton className="aspect-cover w-full" />
        <div className="flex flex-col gap-15"><Skeleton className="h-30 w-3/4" /><SkeletonText lines={3} /></div>
        <Skeleton className="h-[220px] w-full" />
      </div>
    </div>
  );
}

/** /product/:slug (design/screens/product.png). */
export function ProductPage() {
  const { slug = '' } = useParams();
  const { data: product, isPending, error, refetch } = useProduct(slug);
  const addToCart = useAddToCart();

  if (isPending) return <ProductSkeleton />;

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className={PAGE}>
        <h1 className="text-h1 text-fg-primary">Product not found</h1>
        <p className="text-body text-fg-secondary">It may have been removed, or the link is wrong.</p>
        <Link to="/store" className={buttonClasses('primary')}>Browse the store</Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={PAGE}>
        <div role="alert" className="flex flex-col items-start gap-15 bg-canvas-header p-30">
          <h1 className="text-h2-sm text-fg-primary">We couldn’t load this product</h1>
          <Button onClick={() => void refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  const add = (offerId: number) => addToCart(offerId, product.title);
  const lowest = product.offers[0]?.price_cents;

  return (
    <div className={PAGE}>
      <Breadcrumbs product={product} />

      <div className="grid items-start gap-30 lg:grid-cols-[224px_1fr_350px]">
        <div className="aspect-cover w-[180px] overflow-hidden bg-surface-raised lg:w-full">
          <CoverImage
            key={product.cover_url ?? ''}
            url={product.cover_url}
            fallback={<div className="flex size-full items-center justify-center p-15 text-center text-h2-sm text-fg-tertiary">{product.title}</div>}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-20">
          <div className="flex flex-col gap-8">
            <h1 className="text-h1 text-fg-primary">{product.title}</h1>
            <p className="text-body text-fg-secondary">
              {product.platform.name} key ·{' '}
              <span className={product.region.slug === 'global' ? 'text-success' : 'text-fg-region'}>{product.region.name}</span>
            </p>
          </div>
          <Facts product={product} />
          <VariantSwitcher product={product} />
        </div>

        <FeaturedOffer product={product} onAdd={add} />
      </div>

      {product.offers.length > 0 && (
        <section id="offers" aria-labelledby="offers-title" className="flex scroll-mt-20 flex-col gap-15">
          <SectionHeading id="offers-title" size="sm">
            {product.offers.length} {product.offers.length === 1 ? 'offer' : 'offers'}
          </SectionHeading>
          <ul className="flex flex-col gap-10">
            {product.offers.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                productTitle={product.title}
                isLowest={product.offers.length > 1 && offer.price_cents === lowest}
                onAdd={() => add(offer.id)}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="description-title" className="grid gap-20 bg-canvas-header p-20 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-10">
          <h2 id="description-title" className="text-h2-sm text-fg-primary">Description</h2>
          <p className="text-body whitespace-pre-line text-fg-secondary">{product.description ?? 'No description yet.'}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-15 gap-y-8 text-body">
          {product.developer && <><dt className="text-fg-muted">Developer</dt><dd className="text-fg-primary">{product.developer}</dd></>}
          {product.publisher && <><dt className="text-fg-muted">Publisher</dt><dd className="text-fg-primary">{product.publisher}</dd></>}
          {product.release_date && (
            <><dt className="text-fg-muted">Release date</dt><dd className="text-fg-primary">{new Date(product.release_date).toLocaleDateString('en-IE', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></>
          )}
          {product.genres.length > 0 && (
            <>
              <dt className="text-fg-muted">Genres</dt>
              <dd className="flex flex-wrap gap-5">
                {product.genres.map((g) => (
                  <Link key={g.slug} to={`/store?genre=${encodeURIComponent(g.slug)}`} className="rounded-md border border-line-subtle px-8 py-2 text-body-sm text-fg-primary hover:border-line-default">
                    {g.name}
                  </Link>
                ))}
              </dd>
            </>
          )}
        </dl>
      </section>

      <AlsoViewed product={product} />
    </div>
  );
}
