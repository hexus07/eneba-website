import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  /** Visually hide the label (it stays for screen readers), e.g. the newsletter input. */
  hideLabel?: boolean;
  error?: string | undefined;
  hint?: string;
  size?: 'md' | 'lg';
  /** Background: `header` (default, on canvas/panels) or `raised` (on the lighter store sidebar). */
  tone?: 'header' | 'raised';
}

export function TextInput({ label, hideLabel = false, error, hint, size = 'md', tone = 'header', required, id, className, ...props }: TextInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [error && `${inputId}-error`, hint && `${inputId}-hint`].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <label htmlFor={inputId} className={cn('text-body text-fg-secondary', hideLabel && 'sr-only')}>
        {label}
        {required && <span className="ml-4 text-fg-muted" aria-hidden="true">*</span>}
      </label>
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'w-full rounded-none px-20 text-body text-fg-primary placeholder:text-fg-tertiary',
          tone === 'raised' ? 'bg-surface-raised' : 'bg-canvas-header',
          'border border-transparent outline-none focus:border-accent',
          size === 'lg' ? 'h-control-lg' : 'h-control',
          error && 'border-fg-region',
        )}
        {...props}
      />
      {hint && !error && <p id={`${inputId}-hint`} className="text-body-sm text-fg-muted">{hint}</p>}
      {error && <p id={`${inputId}-error`} className="text-body-sm text-fg-region">{error}</p>}
    </div>
  );
}
