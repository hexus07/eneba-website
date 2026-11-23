import { useId } from 'react';
import { Link } from 'react-router';
import { SectionHeading, Skeleton } from '@/components/ui';
import { useHomeBlock } from '../api';
import type { HomeLayoutBlock, PlatformTilesPayload } from '../types';

const GRID = 'grid grid-cols-2 gap-15 sm:grid-cols-4 lg:grid-cols-8 sm:gap-20';

export function PlatformTilesBlock({ block }: { block: HomeLayoutBlock }) {
  const { data } = useHomeBlock<PlatformTilesPayload>(block.key);
  const headingId = useId();
  if (data.items.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-20">
      <SectionHeading id={headingId}>{block.title}</SectionHeading>
      <ul className={GRID}>
        {data.items.map((t) => (
          <li key={t.slug}>
            <Link to={t.url} className="flex h-full flex-col items-center justify-center gap-5 bg-surface-tab p-15 text-center hover:bg-surface-raised">
              <span className="text-label text-fg-primary">{t.name}</span>
              <span className="text-body-sm text-fg-muted">{t.products_count} products</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PlatformTilesSkeleton() {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[70px]" />)}
    </div>
  );
}
