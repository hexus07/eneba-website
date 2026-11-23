import type { FacetDimension, ProductType } from './types';

/**
 * Store state lives in the URL (CLAUDE.md): this module is the single parse/serialize pair between
 * `/store?…` and typed params. URL keys equal the API's, so the API query is the same string.
 */
export const SORTS = ['relevance', 'popular', 'price_asc', 'price_desc', 'newest'] as const;
export type Sort = (typeof SORTS)[number];

export const PRODUCT_TYPES: readonly ProductType[] = ['game', 'dlc', 'gift_card', 'subscription', 'software'];

export const PER_PAGE = 24;

export interface CatalogParams {
  q: string;
  platform: string[];
  region: string[];
  genre: string[];
  type: ProductType[];
  /** cents, inclusive */
  priceMin: number | null;
  priceMax: number | null;
  /** null = server default (relevance with q, popular without) */
  sort: Sort | null;
  page: number;
}

export const LIST_KEYS = ['platform', 'region', 'genre', 'type'] as const satisfies readonly (FacetDimension | 'type')[];
export type ListKey = (typeof LIST_KEYS)[number];

const list = (value: string | null) =>
  [...new Set((value ?? '').split(',').map((v) => v.trim()).filter(Boolean))];

const nonNegativeInt = (value: string | null) => {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
};

export function parseCatalogParams(search: URLSearchParams): CatalogParams {
  const sort = search.get('sort');
  const page = nonNegativeInt(search.get('page'));
  return {
    q: (search.get('q') ?? '').trim(),
    platform: list(search.get('platform')),
    region: list(search.get('region')),
    genre: list(search.get('genre')),
    type: list(search.get('type')).filter((t): t is ProductType => (PRODUCT_TYPES as readonly string[]).includes(t)),
    priceMin: nonNegativeInt(search.get('price_min')),
    priceMax: nonNegativeInt(search.get('price_max')),
    sort: (SORTS as readonly string[]).includes(sort ?? '') ? (sort as Sort) : null,
    page: page && page > 0 ? page : 1,
  };
}

/** Canonical query string: fixed key order, defaults omitted, so equal state = equal URL = one cache entry. */
export function toSearchParams(p: CatalogParams): URLSearchParams {
  const out = new URLSearchParams();
  if (p.q) out.set('q', p.q);
  for (const key of LIST_KEYS) if (p[key].length) out.set(key, p[key].join(','));
  if (p.priceMin !== null) out.set('price_min', String(p.priceMin));
  if (p.priceMax !== null) out.set('price_max', String(p.priceMax));
  if (p.sort) out.set('sort', p.sort);
  if (p.page > 1) out.set('page', String(p.page));
  return out;
}

/** Query for GET /products (adds per_page). */
export function toApiQuery(p: CatalogParams): string {
  const params = toSearchParams(p);
  params.set('per_page', String(PER_PAGE));
  return params.toString();
}

export const EMPTY_PARAMS: CatalogParams = {
  q: '', platform: [], region: [], genre: [], type: [], priceMin: null, priceMax: null, sort: null, page: 1,
};

/** Any filter narrowing the results (search text and sort excluded). */
export function hasActiveFilters(p: CatalogParams): boolean {
  return LIST_KEYS.some((k) => p[k].length > 0) || p.priceMin !== null || p.priceMax !== null;
}

/** Apply a change; any change except to `page` itself goes back to page 1. */
export function updateParams(current: CatalogParams, patch: Partial<CatalogParams>): CatalogParams {
  return { ...current, ...patch, page: 'page' in patch && patch.page !== undefined ? patch.page : 1 };
}

export function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
