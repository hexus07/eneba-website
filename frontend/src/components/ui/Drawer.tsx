import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CloseIcon } from './icons';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky bottom area, e.g. "Show 120 results". */
  footer?: ReactNode;
  side?: 'left' | 'right';
}

/**
 * Off-canvas panel (mobile filters). Modal dialog semantics: Esc and the scrim close it, focus moves
 * into it on open and back to the opener on close, and the page behind doesn't scroll.
 */
export function Drawer({ open, onClose, title, children, footer, side = 'left' }: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-overlay-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full max-w-[360px] flex-col bg-canvas-base shadow-popup outline-none',
          side === 'right' && 'ml-auto',
        )}
      >
        <div className="flex h-header shrink-0 items-center justify-between border-b border-line-subtle px-20">
          <h2 id={titleId} className="text-h2-sm text-fg-primary">{title}</h2>
          <button type="button" onClick={onClose} className="inline-flex size-control-sm items-center justify-center text-fg-primary hover:text-accent">
            <CloseIcon className="size-icon" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="shrink-0 border-t border-line-subtle p-15">{footer}</div>}
      </div>
    </div>
  );
}
