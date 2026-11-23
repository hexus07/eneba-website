import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { HomeBlockResponse, HomeLayoutBlock } from './types';

export function useHomeLayout() {
  return useQuery({
    queryKey: ['home'],
    queryFn: ({ signal }) => apiClient.get<{ data: HomeLayoutBlock[] }>('/home', { signal }).then((r) => r.data),
  });
}

/**
 * One block's content. Suspense-based: the block's slot shows its skeleton while loading and its
 * error boundary on failure, so blocks load and fail independently.
 */
export function useHomeBlock<P>(key: string) {
  return useSuspenseQuery({
    queryKey: ['home-block', key],
    queryFn: ({ signal }) => apiClient.get<HomeBlockResponse<P>>(`/home/blocks/${encodeURIComponent(key)}`, { signal }).then((r) => r.data),
  });
}
