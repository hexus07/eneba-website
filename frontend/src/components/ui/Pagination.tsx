import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { ChevronRightIcon } from './icons';
import { pageWindow } from './pageWindow';

export interface PaginationProps {
  page: number;
  lastPage: number;
  /** href for a page number: pagination is real links, so it works with the URL state and new tabs. */
  hrefFor: (page: number) => string;
  className?: string;
}

const cell = 'inline-flex h-control-sm min-w-control-sm items-center justify-center px-8 text-body';

export function Pagination({ page, lastPage, hrefFor, className }: PaginationProps) {
  if (lastPage <= 1) return null;
  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center justify-center gap-5', className)}>
      {page > 1 ? (
        <Link to={hrefFor(page - 1)} rel="prev" className={cn(cell, 'border border-line-default hover:bg-fg-primary/10')}>
          <ChevronRightIcon className="size-icon-sm rotate-180" />
          <span className="sr-only">Previous page</span>
        </Link>
      ) : null}
      {pageWindow(page, lastPage).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className={cn(cell, 'text-fg-tertiary')} aria-hidden="true">…</span>
        ) : (
          <Link
            key={p}
            to={hrefFor(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            className={cn(cell, p === page ? 'bg-accent text-fg-on-accent font-bold' : 'border border-line-subtle hover:border-line-default')}
          >
            {p}
          </Link>
        ),
      )}
      {page < lastPage ? (
        <Link to={hrefFor(page + 1)} rel="next" className={cn(cell, 'border border-line-default hover:bg-fg-primary/10')}>
          <span className="sr-only">Next page</span>
          <ChevronRightIcon className="size-icon-sm" />
        </Link>
      ) : null}
    </nav>
  );
}
