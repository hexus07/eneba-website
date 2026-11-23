import { cn } from '@/lib/cn';

const sizes = { sm: 'size-icon-sm border-2', md: 'size-icon-lg border-2', lg: 'size-[70px] border-4' } as const;

/** Ring spinner (checkout "processing payment" uses lg). Announced to screen readers via role=status. */
export function Spinner({ size = 'md', label = 'Loading', className }: { size?: keyof typeof sizes; label?: string; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex', className)}>
      <span className={cn('animate-spin rounded-full border-fg-primary/20 border-t-accent', sizes[size])} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
