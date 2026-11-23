import { useRef, type ReactNode } from 'react';
import { ChevronRightIcon } from './icons';

/**
 * Horizontally scrolling row (product carousels). Native scroll with snap, so touch, trackpad and
 * keyboard work; prev/next buttons page by the visible width on larger screens.
 */
export function ScrollRow({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  };
  const nav = 'absolute top-1/2 z-10 hidden size-control items-center justify-center bg-overlay-scrim text-fg-primary backdrop-blur-scrim hover:text-accent md:flex';

  return (
    <div className="relative">
      <ul ref={ref} aria-label={label} className="flex snap-x snap-mandatory gap-15 overflow-x-auto pb-10 sm:gap-20">
        {children}
      </ul>
      <button type="button" onClick={() => page(-1)} className={`${nav} -left-20 -translate-y-1/2`} aria-label={`Scroll ${label} left`}>
        <ChevronRightIcon className="size-icon rotate-180" />
      </button>
      <button type="button" onClick={() => page(1)} className={`${nav} -right-20 -translate-y-1/2`} aria-label={`Scroll ${label} right`}>
        <ChevronRightIcon className="size-icon" />
      </button>
    </div>
  );
}
