import { Chip } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { EMPTY_PARAMS, hasActiveFilters, type CatalogParams } from './catalogParams';
import { TYPE_LABELS } from './labels';
import type { FacetDimension, ProductsResponse } from './types';

const humanize = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');

/** One removable chip per active filter, plus "Clear all" (keeps the search text). */
export function ActiveFilters({ params, meta, onChange }: { params: CatalogParams; meta: ProductsResponse['meta'] | undefined; onChange: (patch: Partial<CatalogParams>) => void }) {
  if (!hasActiveFilters(params)) return null;

  // Before the first response there are no facet names yet: show a readable slug, not "north-america".
  const name = (dimension: FacetDimension, slug: string) =>
    meta?.facets[dimension].find((o) => o.slug === slug)?.name ?? humanize(slug);
  const chips: { key: string; label: string; remove: Partial<CatalogParams> }[] = [
    ...(['platform', 'region', 'genre'] as const).flatMap((d) =>
      params[d].map((slug) => ({ key: `${d}:${slug}`, label: name(d, slug), remove: { [d]: params[d].filter((s) => s !== slug) } })),
    ),
    ...params.type.map((t) => ({ key: `type:${t}`, label: TYPE_LABELS[t], remove: { type: params.type.filter((x) => x !== t) } })),
  ];
  if (params.priceMin !== null || params.priceMax !== null) {
    const lo = params.priceMin === null ? '' : formatMoney(params.priceMin);
    const hi = params.priceMax === null ? '' : formatMoney(params.priceMax);
    chips.push({ key: 'price', label: lo && hi ? `${lo} – ${hi}` : lo ? `From ${lo}` : `Up to ${hi}`, remove: { priceMin: null, priceMax: null } });
  }

  return (
    <div className="flex flex-wrap items-center gap-10" aria-label="Active filters" role="group">
      {chips.map((c) => <Chip key={c.key} label={c.label} onRemove={() => onChange(c.remove)} />)}
      <button
        type="button"
        onClick={() => onChange({ ...EMPTY_PARAMS, q: params.q, sort: params.sort })}
        className="text-body text-accent hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
