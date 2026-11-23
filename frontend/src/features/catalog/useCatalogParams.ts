import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { parseCatalogParams, toSearchParams, updateParams, type CatalogParams } from './catalogParams';

/** Read/write the store state in the URL. Each change is a history entry, so Back undoes a filter. */
export function useCatalogParams(): [CatalogParams, (patch: Partial<CatalogParams>) => void, (next: CatalogParams) => string] {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseCatalogParams(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<CatalogParams>) => setSearchParams(toSearchParams(updateParams(params, patch))),
    [params, setSearchParams],
  );

  /** href for a given state, for real links (pagination, "did you mean"). */
  const hrefFor = useCallback((next: CatalogParams) => {
    const qs = toSearchParams(next).toString();
    return qs ? `/store?${qs}` : '/store';
  }, []);

  return [params, update, hrefFor];
}
