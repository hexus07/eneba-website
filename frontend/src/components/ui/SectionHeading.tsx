import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { InfoIcon } from './icons';

export interface SectionHeadingProps {
  children: ReactNode;
  /** lg = home sections (30px), sm = product/cart sections (18px). */
  size?: 'lg' | 'sm';
  /** Shown as a native tooltip next to the title (the ⓘ in the design). */
  info?: string;
  /** Element rendered on the right, e.g. a "See all" link. */
  action?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function SectionHeading({ children, size = 'lg', info, action, as: Tag = 'h2', className }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-center justify-between gap-20', className)}>
      <Tag className={cn('flex items-center gap-8 text-fg-primary', size === 'lg' ? 'text-h2' : 'text-h2-sm')}>
        {children}
        {info && (
          <span title={info} className="inline-flex text-fg-tertiary">
            <InfoIcon className={size === 'lg' ? 'size-icon' : 'size-icon-sm'} aria-label={info} />
          </span>
        )}
      </Tag>
      {action}
    </div>
  );
}
