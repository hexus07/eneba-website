import { Link } from 'react-router';
import { buttonClasses, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useHomeBlock } from '../api';
import type { BannerTheme, HeroBannerPayload, HomeLayoutBlock } from '../types';

/** Our own banners: token gradients + text, no artwork (PLAN.md §6, FIGMA_CLEANUP.md "reference only"). */
const THEMES: Record<BannerTheme, { bg: string; title: string; subtitle: string; cta: string }> = {
  violet: {
    bg: 'bg-linear-to-br from-surface-tab via-canvas-header to-surface-card',
    title: 'text-fg-primary',
    subtitle: 'text-fg-secondary',
    cta: buttonClasses('primary', 'lg'),
  },
  gold: {
    bg: 'bg-linear-to-br from-accent via-accent to-accent-cashback',
    title: 'text-fg-on-accent',
    subtitle: 'text-fg-on-accent/80',
    cta: 'inline-flex h-control-lg items-center px-30 text-button bg-surface-card text-fg-primary hover:bg-surface-raised',
  },
  teal: {
    bg: 'bg-linear-to-br from-success via-canvas-header to-surface-card',
    title: 'text-fg-primary',
    subtitle: 'text-fg-secondary',
    cta: buttonClasses('primary', 'lg'),
  },
};

export function HeroBannerBlock({ block }: { block: HomeLayoutBlock }) {
  const { data } = useHomeBlock<HeroBannerPayload>(block.key);
  if (data.items.length === 0) return null;
  const [main, ...side] = data.items;

  return (
    <section aria-label={block.title} className="grid gap-20 lg:grid-cols-3">
      {[main, ...side.slice(0, 2)].map((banner, i) =>
        banner ? (
          <article
            key={banner.id}
            data-theme={banner.theme}
            className={cn(
              'relative flex flex-col justify-end gap-15 overflow-hidden p-30',
              THEMES[banner.theme].bg,
              i === 0 ? 'min-h-[320px] lg:col-span-2 lg:row-span-2 lg:p-50' : 'min-h-[150px]',
            )}
          >
            {/* Decorative rings: pure CSS, no imagery. */}
            <span aria-hidden="true" className="absolute -top-50 -right-50 size-[260px] rounded-full border-[30px] border-fg-primary/10" />
            <span aria-hidden="true" className="absolute top-40 right-40 size-[90px] rounded-full border-[12px] border-fg-primary/10" />
            <h2 className={cn('relative max-w-[520px]', THEMES[banner.theme].title, i === 0 ? 'text-h2 lg:text-[44px] lg:leading-[48px]' : 'text-h2-sm')}>
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className={cn('relative max-w-[440px]', THEMES[banner.theme].subtitle, i === 0 ? 'text-body' : 'text-body-sm')}>{banner.subtitle}</p>
            )}
            <Link to={banner.cta.url} className={cn('relative w-fit', i === 0 ? THEMES[banner.theme].cta : 'text-label underline-offset-4 hover:underline', i !== 0 && THEMES[banner.theme].title)}>
              {banner.cta.label}
              {i !== 0 && ' →'}
            </Link>
          </article>
        ) : null,
      )}
    </section>
  );
}

export function HeroBannerSkeleton() {
  return (
    <div className="grid gap-20 lg:grid-cols-3" aria-hidden="true">
      <Skeleton className="min-h-[320px] lg:col-span-2 lg:row-span-2" />
      <Skeleton className="hidden min-h-[150px] lg:block" />
      <Skeleton className="hidden min-h-[150px] lg:block" />
    </div>
  );
}
