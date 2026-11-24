import { useQuery } from '@tanstack/react-query';
import type { ProductsResponse } from '@/features/catalog/types';
import { apiClient } from '@/lib/apiClient';
import type { ProductDetail } from './types';

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: ({ signal }) => apiClient.get<{ data: ProductDetail }>(`/products/${encodeURIComponent(slug)}`, { signal }).then((r) => r.data),
  });
}

/**
 * "Gamers also viewed": the most popular products sharing this one's first genre (catalog API),
 * one per title, excluding this title. Empty when the product has no genre.
 */
export function useAlsoViewed(product: ProductDetail | undefined, limit = 5) {
  const genre = product?.genres[0]?.slug;
  return useQuery({
    queryKey: ['also-viewed', genre, product?.title],
    enabled: genre !== undefined,
    queryFn: ({ signal }) =>
      apiClient
        .get<ProductsResponse>(`/products?genre=${encodeURIComponent(genre ?? '')}&sort=popular&per_page=24`, { signal })
        .then((r) => {
          const seen = new Set([product?.title]);
          return r.data.filter((p) => p.offers_count > 0 && !seen.has(p.title) && seen.add(p.title)).slice(0, limit);
        }),
  });
}
