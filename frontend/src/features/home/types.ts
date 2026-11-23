import type { ProductCardData } from '@/features/catalog/types';

/** GET /home → data[] */
export interface HomeLayoutBlock {
  key: string;
  type: string;
  title: string;
  endpoint: string;
}

interface HomeBlockMeta {
  key: string;
  type: string;
  title: string;
}

/** GET /home/blocks/{key} → data: block metadata + provider payload */
export interface HomeBlockResponse<P> {
  data: HomeBlockMeta & P;
}

export type BannerTheme = 'violet' | 'gold' | 'teal';

export interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  theme: BannerTheme;
  image_url: string | null;
  cta: { label: string; url: string };
}

export interface HeroBannerPayload {
  items: Banner[];
}

export interface ProductRowPayload {
  items: ProductCardData[];
  see_all_url: string | null;
}

export interface Deal {
  offer_id: number;
  price_cents: number;
  original_price_cents: number;
  discount_percent: number;
  seller_name: string;
}

export interface DealsPayload {
  items: (ProductCardData & { deal: Deal })[];
  see_all_url: string | null;
}

export interface PlatformTile {
  slug: string;
  name: string;
  products_count: number;
  url: string;
}

export interface PlatformTilesPayload {
  items: PlatformTile[];
}
