import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { NamedRef } from '@/features/catalog/types';

/** Mirrors App\Http\Resources\SearchSuggestionResource */
export interface Suggestion {
  slug: string;
  title: string;
  cover_url: string | null;
  min_price_cents: number | null;
  currency: string;
  platform: NamedRef;
}

export const MIN_SUGGEST_LENGTH = 2;

export function useSuggestions(query: string) {
  return useQuery({
    queryKey: ['suggest', query],
    queryFn: ({ signal }) => apiClient.get<{ data: Suggestion[] }>(`/search/suggest?q=${encodeURIComponent(query)}`, { signal }).then((r) => r.data),
    enabled: query.length >= MIN_SUGGEST_LENGTH,
    staleTime: 60_000,
  });
}
