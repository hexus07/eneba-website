import { useState } from 'react';
import { Link } from 'react-router';
import {
  Button, buttonClasses, Drawer, Pagination, ProductCard, ProductCardSkeleton, SectionHeading, Select, Skeleton, SkeletonText,
} from '@/components/ui';
import { ApiError } from '@/lib/apiClient';
import { ActiveFilters } from './ActiveFilters';
import { useProducts } from './api';
import { EMPTY_PARAMS, hasActiveFilters, PER_PAGE, SORTS, type CatalogParams, type Sort } from './catalogParams';
import { FilterPanel } from './FilterPanel';
import { SORT_LABELS, TYPE_LABELS } from './labels';
import { toCardProps } from './toCardProps';
import { useCatalogParams } from './useCatalogParams';

function heading(p: CatalogParams): string {
  if (p.q) return `Results for “${p.q}”`;
  if (p.type.length === 1 && p.type[0]) return TYPE_LABELS[p.type[0]];
  return 'Buy game keys at the best price';
}

const GRID = 'grid grid-cols-2 gap-15 sm:grid-cols-3 sm:gap-20 lg:grid-cols-4';

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-20 bg-surface-tab p-20" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-12">
          <Skeleton className="h-20 w-1/2" />
          <SkeletonText lines={4} />
        </div>
      ))}
    </div>
  );
}

export function StorePage() {
  const [params, update, hrefFor] = useCatalogParams();
  const { data, isPending, isError, error, isFetching, isPlaceholderData, refetch } = useProducts(params);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const meta = data?.meta;
  const sortOptions = SORTS.filter((s) => s !== 'relevance' || params.q).map((s) => ({ value: s, label: SORT_LABELS[s] }));
  const currentSort: Sort = params.sort ?? (params.q ? 'relevance' : 'popular');
  const activeCount = params.platform.length + params.region.length + params.genre.length + params.type.length + (params.priceMin !== null || params.priceMax !== null ? 1 : 0);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-20 px-15 py-30 xl:px-0">
      <nav aria-label="Breadcrumb" className="text-body text-fg-secondary">
        <ol className="flex items-center gap-8">
          <li><Link to="/" className="hover:text-accent">Home</Link></li>
          <li aria-hidden="true">›</li>
          <li><Link to="/store" aria-current={params.q || hasActiveFilters(params) ? undefined : 'page'} className="hover:text-accent">Store</Link></li>
        </ol>
      </nav>
      <SectionHeading as="h1">{heading(params)}</SectionHeading>

      <div className="grid gap-20 lg:grid-cols-[220px_1fr]">
        <aside aria-label="Filters" className="hidden lg:block">
          {meta ? <FilterPanel params={params} meta={meta} onChange={update} /> : <SidebarSkeleton />}
        </aside>

        <section aria-label="Products" className="flex min-w-0 flex-col gap-20">
          <ActiveFilters params={params} meta={meta} onChange={update} />

          <div className="flex flex-wrap items-center justify-between gap-10">
            <p className="text-body text-fg-secondary" aria-live="polite">
              {meta ? <>Results found: <strong className="text-fg-primary">{meta.total}</strong></> : <span className="sr-only">Loading results</span>}
            </p>
            <div className="flex items-center gap-15">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)} disabled={!meta}>
                Filters{activeCount > 0 ? ` (${activeCount})` : ''}
              </Button>
              <Select
                label="Sort by"
                value={currentSort}
                onChange={(e) => update({ sort: e.target.value as Sort })}
                options={sortOptions}
              />
            </div>
          </div>

          {isPending ? (
            <div className={GRID} aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : isError ? (
            <div role="alert" className="flex flex-col items-start gap-15 bg-surface-card p-30">
              <h2 className="text-h2-sm text-fg-primary">We couldn’t load the store</h2>
              <p className="text-body text-fg-secondary">
                {error instanceof ApiError && error.status >= 500 ? 'The server is having trouble (it may be waking up). Try again in a moment.' : 'Check your connection and try again.'}
              </p>
              <Button onClick={() => void refetch()}>Try again</Button>
            </div>
          ) : data.data.length === 0 ? (
            <div className="flex flex-col items-start gap-15 bg-surface-card p-30">
              <h2 className="text-h2-sm text-fg-primary">{params.q ? `No results for “${params.q}”` : 'No products match these filters'}</h2>
              {data.meta.did_you_mean && (
                <p className="text-body text-fg-secondary">
                  Did you mean{' '}
                  <Link to={hrefFor({ ...params, q: data.meta.did_you_mean, page: 1 })} className="font-bold text-accent hover:underline">
                    {data.meta.did_you_mean}
                  </Link>
                  ?
                </p>
              )}
              <div className="flex flex-wrap gap-10">
                {hasActiveFilters(params) && (
                  <Button variant="outline" onClick={() => update({ ...EMPTY_PARAMS, q: params.q })}>Clear filters</Button>
                )}
                {params.q && <Link to="/store" className={buttonClasses('outline')}>Browse all products</Link>}
              </div>
            </div>
          ) : (
            <>
              <ul className={GRID} aria-busy={isFetching && isPlaceholderData ? true : undefined}>
                {data.data.map((p) => (
                  <li key={p.id} className={isFetching && isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                    <ProductCard {...toCardProps(p)} className="h-full" />
                  </li>
                ))}
              </ul>
              <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} hrefFor={(page) => hrefFor({ ...params, page })} />
              <p className="sr-only">Showing {data.meta.from}–{data.meta.to} of {data.meta.total}, {PER_PAGE} per page</p>
            </>
          )}
        </section>
      </div>

      {meta && (
        <Drawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filters"
          footer={<Button fullWidth onClick={() => setFiltersOpen(false)}>Show {meta.total} results</Button>}
        >
          <FilterPanel params={params} meta={meta} onChange={update} />
        </Drawer>
      )}
    </div>
  );
}
