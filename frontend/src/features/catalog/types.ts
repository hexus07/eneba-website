/** Mirrors App\Http\Resources\ProductCardResource */
export type ProductType = 'game' | 'dlc' | 'gift_card' | 'subscription' | 'software';

export interface NamedRef {
  slug: string;
  name: string;
}

export interface ProductCardData {
  id: number;
  slug: string;
  title: string;
  type: ProductType;
  platform: NamedRef;
  region: NamedRef;
  cover_url: string | null;
  min_price_cents: number | null;
  currency: string;
  offers_count: number;
  release_date: string | null;
}

export interface FacetOption extends NamedRef {
  count: number;
  selected: boolean;
}

export type FacetDimension = 'platform' | 'region' | 'genre';

/** GET /api/v1/products */
export interface ProductsResponse {
  data: ProductCardData[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    facets: Record<FacetDimension, FacetOption[]>;
    price_range: { min: number | null; max: number | null };
    did_you_mean: string | null;
  };
}
