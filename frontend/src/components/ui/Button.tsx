import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonClasses';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** Required for variant="icon" (no visible text). */
  'aria-label'?: string;
  children?: ReactNode;
}

export type { ButtonSize, ButtonVariant };

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  if (variant === 'icon' && !props['aria-label'] && import.meta.env.DEV) {
    console.warn('<Button variant="icon"> needs an aria-label');
  }
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses(variant, size, fullWidth), className)}
      {...props}
    >
      {loading ? <Spinner size="sm" label="Loading" /> : children}
    </button>
  );
}
