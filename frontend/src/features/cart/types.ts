import type { NamedRef } from '@/features/catalog/types';

/** Mirrors App\Http\Resources\CartItemResource. `id` is null in guest previews. */
export interface CartLine {
  id: number | null;
  offer_id: number;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  currency: string;
  available_stock: number;
  is_purchasable: boolean;
  product: { slug: string; title: string; cover_url: string | null; platform: NamedRef; region: NamedRef };
  seller: { slug: string; name: string; rating: number };
}

/** GET /cart, POST /cart/preview, and every cart mutation → { data: Cart } */
export interface Cart {
  items: CartLine[];
  totals: { items_count: number; subtotal_cents: number; currency: string; is_purchasable: boolean };
}

export const EMPTY_CART: Cart = { items: [], totals: { items_count: 0, subtotal_cents: 0, currency: 'EUR', is_purchasable: false } };
