import { useId, useState } from 'react';
import { Checkbox, ChevronRightIcon } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { FacetOption } from './types';

const VISIBLE = 8;

export interface FacetGroupProps {
  title: string;
  options: FacetOption[];
  onToggle: (slug: string) => void;
}

/** Collapsible checkbox list with counts, like the store sidebar on eneba.com. */
export function FacetGroup({ title, options, onToggle }: FacetGroupProps) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const selected = options.filter((o) => o.selected).length;
  // Never hide a selected option behind "Show more".
  const visible = showAll ? options : options.filter((o, i) => i < VISIBLE || o.selected);

  if (options.length === 0) return null;

  return (
    <section className="border-t border-canvas-base px-20 py-15 first:border-t-0">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listId}
          className="flex w-full items-center gap-8 text-h2-sm text-fg-primary"
        >
          <span className="flex-1 text-left">{title}</span>
          {selected > 0 && (
            <span className="flex size-icon items-center justify-center rounded-full bg-accent text-badge text-fg-on-accent">
              {selected}
              <span className="sr-only"> selected</span>
            </span>
          )}
          <ChevronRightIcon className={cn('size-icon transition-transform', open ? '-rotate-90' : 'rotate-90')} />
        </button>
      </h3>
      <div id={listId} hidden={!open} className="mt-15">
        <ul className="flex flex-col gap-12">
          {visible.map((o) => (
            <li key={o.slug}>
              <Checkbox
                className="w-full"
                checked={o.selected}
                onChange={() => onToggle(o.slug)}
                label={
                  <span className={cn('flex justify-between gap-10', o.count === 0 && !o.selected && 'opacity-50')}>
                    <span>{o.name}</span>
                    <span className="text-fg-muted">{o.count}</span>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
        {options.length > VISIBLE && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-12 text-label text-accent hover:underline">
            {showAll ? 'Show less' : `Show all (${options.length})`}
          </button>
        )}
      </div>
    </section>
  );
}
