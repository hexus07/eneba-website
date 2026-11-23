import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { toApiQuery, type CatalogParams } from './catalogParams';
import type { ProductsResponse } from './types';

export function fetchProducts(params: CatalogParams, signal?: AbortSignal): Promise<ProductsResponse> {
  return apiClient.get<ProductsResponse>(`/products?${toApiQuery(params)}`, signal ? { signal } : {});
}

/** Keeps the previous page on screen while the next query loads (no grid flash on every filter click). */
export function useProducts(params: CatalogParams) {
  const query = toApiQuery(params);
  return useQuery({
    queryKey: ['products', query],
    queryFn: ({ signal }) => fetchProducts(params, signal),
    placeholderData: keepPreviousData,
  });
}
