import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CheckIcon } from './icons';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

/** Native checkbox (keyboard, forms, a11y for free) drawn as Eneba's yellow square. */
export function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn('inline-flex cursor-pointer items-start gap-12 text-body text-fg-subtle', className)}>
      <span className="relative mt-2 inline-flex size-icon shrink-0">
        <input id={inputId} type="checkbox" className="peer absolute inset-0 m-0 cursor-pointer opacity-0" {...props} />
        <span
          aria-hidden="true"
          className={cn(
            'flex size-icon items-center justify-center rounded-xs border border-line-default text-transparent',
            'peer-checked:border-accent peer-checked:bg-accent peer-checked:text-fg-on-accent',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
            'peer-disabled:opacity-50',
          )}
        >
          <CheckIcon className="size-icon-sm" strokeWidth={3} />
        </span>
      </span>
      <span className="flex-1">{label}</span>
    </label>
  );
}
