import { cn } from '@/lib/cn';
import { useToastStore } from '@/lib/toastStore';
import { CloseIcon } from './icons';

/** Announces toasts politely (errors assertively) and shows them bottom-right. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed right-15 bottom-15 z-50 flex w-[calc(100%-30px)] max-w-[360px] flex-col gap-10">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-10 border-l-4 bg-surface-card p-15 text-body text-fg-primary shadow-popup',
            t.tone === 'error' ? 'border-fg-region' : 'border-success',
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-fg-tertiary hover:text-fg-primary">
            <CloseIcon className="size-icon-sm" />
          </button>
        </div>
      ))}
    </div>
  );
}
