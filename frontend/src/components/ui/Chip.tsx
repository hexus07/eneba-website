import { CloseIcon } from './icons';

/** Removable pill for an active filter ("Steam ×"). The whole chip is the remove button. */
export function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter: ${label}`}
      className="inline-flex h-control-sm items-center gap-8 rounded-full bg-surface-card px-15 text-label text-fg-primary hover:bg-surface-raised"
    >
      {label}
      <CloseIcon className="size-icon-sm" />
    </button>
  );
}
