import { Link } from 'react-router';
import { BRAND } from '@/app/brand';
import { Button, buttonClasses } from '@/components/ui';
import { useHomeLayout } from './api';
import { blockRegistry } from './blockRegistry';
import { BlockSlot } from './BlockSlot';
import { HeroBannerSkeleton } from './blocks/HeroBannerBlock';
import { ProductRowSkeleton } from './blocks/ProductRowBlock';

const PAGE = 'mx-auto flex max-w-content flex-col gap-50 px-15 py-30 xl:px-0';

/** Renders only what GET /home returns, in that order, through blockRegistry. Nothing hardcoded. */
export function HomePage() {
  const { data: blocks, isPending, isError, refetch } = useHomeLayout();

  return (
    <div className={PAGE}>
      <h1 className="sr-only">{BRAND.name}: game keys marketplace</h1>
      {isPending ? (
        <>
          <HeroBannerSkeleton />
          <ProductRowSkeleton block={{ key: 'loading', type: 'loading', title: '', endpoint: '' }} />
        </>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-15 bg-surface-card p-30">
          <h2 className="text-h2-sm text-fg-primary">We couldn’t load the homepage</h2>
          <p className="text-body text-fg-secondary">The server may be waking up. Try again in a moment, or go straight to the store.</p>
          <div className="flex gap-10">
            <Button onClick={() => void refetch()}>Try again</Button>
            <Link to="/store" className={buttonClasses('outline')}>Browse the store</Link>
          </div>
        </div>
      ) : (
        blocks.map((block) => {
          const definition = blockRegistry[block.type];
          return definition ? <BlockSlot key={block.key} block={block} definition={definition} /> : null;
        })
      )}
    </div>
  );
}
