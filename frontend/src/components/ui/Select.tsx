import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { ChevronRightIcon } from './icons';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  /** Show the label inline before the select ("Sort by:") or visually hidden. */
  labelMode?: 'inline' | 'hidden';
  options: { value: string; label: string }[];
}

/** Styled native <select>: keyboard, screen readers and mobile pickers work out of the box. */
export function Select({ label, labelMode = 'inline', options, id, className, ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cn('inline-flex items-center gap-8', className)}>
      <label htmlFor={selectId} className={labelMode === 'hidden' ? 'sr-only' : 'text-body text-fg-secondary whitespace-nowrap'}>
        {label}
      </label>
      <span className="relative inline-flex">
        <select
          id={selectId}
          className="h-control-sm appearance-none bg-transparent pr-30 pl-5 text-label text-fg-primary outline-none focus-visible:outline-2 focus-visible:outline-accent"
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface-card text-fg-primary">{o.label}</option>
          ))}
        </select>
        <ChevronRightIcon className="pointer-events-none absolute top-1/2 right-5 size-icon-sm -translate-y-1/2 rotate-90 text-fg-primary" />
      </span>
    </div>
  );
}
