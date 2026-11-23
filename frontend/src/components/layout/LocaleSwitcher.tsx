import { cn } from '@/lib/cn';
import { GlobeIcon } from '@/components/ui';

/**
 * Static for now: the store is EUR / English only (PLAN.md §1). Rendered as plain text, not a
 * button, so it doesn't pretend to open a menu that doesn't exist.
 */
export function LocaleSwitcher({ variant = 'plain', size = 'md', className }: { variant?: 'plain' | 'outlined'; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      aria-label="Language: English EU, currency: EUR"
      className={cn(
        'inline-flex items-center gap-8 text-fg-primary whitespace-nowrap',
        size === 'sm' ? 'text-body-sm' : 'text-body',
        variant === 'outlined' && 'h-control border border-line-default px-15 font-bold',
        className,
      )}
    >
      <GlobeIcon className="size-icon-sm" />
      <span aria-hidden="true">English EU</span>
      <span aria-hidden="true" className="h-12 w-px bg-fg-primary" />
      <span aria-hidden="true">EUR</span>
    </span>
  );
}
