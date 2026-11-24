import type { NamedRef, ProductCardData } from '@/features/catalog/types';

/** Mirrors App\Http\Resources\OfferResource */
export interface Offer {
  id: number;
  price_cents: number;
  original_price_cents: number | null;
  discount_percent: number | null;
  currency: string;
  available_stock: number;
  seller: { slug: string; name: string; rating: number; reviews_count: number; is_verified: boolean };
}

export interface ProductVariant {
  slug: string;
  platform: NamedRef;
  region: NamedRef;
  min_price_cents: number | null;
  offers_count: number;
}

/** Mirrors App\Http\Resources\ProductDetailResource (GET /products/{slug}) */
export interface ProductDetail extends ProductCardData {
  description: string | null;
  developer: string | null;
  publisher: string | null;
  genres: NamedRef[];
  /** Purchasable offers (active, in stock), cheapest first. */
  offers: Offer[];
  /** Same title on other platforms / regions. */
  variants: ProductVariant[];
}
