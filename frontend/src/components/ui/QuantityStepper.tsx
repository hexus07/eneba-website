import { cn } from '@/lib/cn';
import { MinusIcon, PlusIcon } from './icons';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Used in button labels: "Decrease quantity of {itemLabel}". */
  itemLabel?: string;
  className?: string;
}

/** "−  1  +" as in the cart. Clamps to [min, max]; the buttons disable at the bounds. */
export function QuantityStepper({ value, onChange, min = 1, max = 10, disabled = false, itemLabel, className }: QuantityStepperProps) {
  const suffix = itemLabel ? ` of ${itemLabel}` : '';
  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== value) onChange(clamped);
  };
  const btn = 'inline-flex size-control-sm items-center justify-center text-fg-primary hover:text-accent disabled:opacity-40 disabled:hover:text-fg-primary';

  return (
    <div className={cn('inline-flex items-center', className)} role="group" aria-label={`Quantity${suffix}`}>
      <button type="button" className={btn} onClick={() => set(value - 1)} disabled={disabled || value <= min} aria-label={`Decrease quantity${suffix}`}>
        <MinusIcon className="size-icon-sm" />
      </button>
      <output className="min-w-20 text-center text-body text-fg-primary" aria-live="polite">{value}</output>
      <button type="button" className={btn} onClick={() => set(value + 1)} disabled={disabled || value >= max} aria-label={`Increase quantity${suffix}`}>
        <PlusIcon className="size-icon-sm" />
      </button>
    </div>
  );
}
