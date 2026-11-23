import { cn } from '@/lib/cn';
import { CheckIcon } from '@/components/ui';

const STEPS = ['Cart', 'Payment', 'Get your product'] as const;

/** 1 Cart — 2 Payment — 3 Get your product (checkout header). `current` is 1-based. */
export function CheckoutStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-1 items-center gap-10" aria-label="Checkout progress">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className={cn('flex items-center gap-10', i < STEPS.length - 1 && 'flex-1')} aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-icon-lg shrink-0 items-center justify-center rounded-full text-label',
                done || active ? 'bg-success text-fg-on-accent' : 'bg-fg-primary/20 text-fg-disabled',
              )}
            >
              {done ? <CheckIcon className="size-icon-sm" strokeWidth={3} /> : step}
            </span>
            <span className={cn('hidden text-body whitespace-nowrap sm:inline', active ? 'text-success' : done ? 'text-fg-primary' : 'text-fg-disabled')}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="hidden h-px flex-1 bg-fg-primary/30 sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
