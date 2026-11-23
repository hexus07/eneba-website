import { toggleValue, type CatalogParams } from './catalogParams';
import { FacetGroup } from './FacetGroup';
import { PriceRangeFilter } from './PriceRangeFilter';
import type { ProductsResponse } from './types';

export interface FilterPanelProps {
  params: CatalogParams;
  meta: ProductsResponse['meta'];
  onChange: (patch: Partial<CatalogParams>) => void;
}

/** Sidebar content (desktop) and drawer content (mobile). */
export function FilterPanel({ params, meta, onChange }: FilterPanelProps) {
  return (
    <div className="bg-surface-tab">
      <PriceRangeFilter
        key={`${params.priceMin ?? ''}-${params.priceMax ?? ''}`}
        min={params.priceMin}
        max={params.priceMax}
        available={meta.price_range}
        onApply={(priceMin, priceMax) => onChange({ priceMin, priceMax })}
      />
      <FacetGroup title="Platform" options={meta.facets.platform} onToggle={(s) => onChange({ platform: toggleValue(params.platform, s) })} />
      <FacetGroup title="Region" options={meta.facets.region} onToggle={(s) => onChange({ region: toggleValue(params.region, s) })} />
      <FacetGroup title="Genre" options={meta.facets.genre} onToggle={(s) => onChange({ genre: toggleValue(params.genre, s) })} />
    </div>
  );
}
