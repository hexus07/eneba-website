import { cn } from '@/lib/cn';

/** Placeholder block. Size it with className (e.g. `h-20 w-full`). Hidden from assistive tech. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block animate-pulse bg-surface-raised', className)} />;
}

/** N lines of text-height skeletons; the last one shorter, like a real paragraph. */
export function SkeletonText({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex flex-col gap-5', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-12', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </span>
  );
}
