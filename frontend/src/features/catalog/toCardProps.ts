import type { ProductCardProps } from '@/components/ui';
import type { ProductCardData } from './types';

/** API product card → ProductCard props. */
export function toCardProps(p: ProductCardData): ProductCardProps {
  return {
    href: `/product/${p.slug}`,
    title: p.title,
    coverUrl: p.cover_url,
    platformName: p.platform.name,
    regionName: p.region.name,
    isGlobal: p.region.slug === 'global',
    priceCents: p.offers_count > 0 ? p.min_price_cents : null,
    currency: p.currency,
  };
}
