import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'outline' | 'secondary' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-8 rounded-none text-button whitespace-nowrap select-none ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  // Yellow CTA ("Buy now", "Proceed to checkout")
  primary: 'bg-accent text-fg-on-accent hover:bg-accent/90 active:bg-accent/80',
  // Bordered, full-width-ish section actions ("See all", "Load more", "Log in with password")
  outline: 'border border-line-default text-fg-primary hover:bg-fg-primary/10',
  // Compact inline action in rows ("Buy now" on offer rows)
  secondary: 'border border-line-default text-fg-primary hover:bg-fg-primary hover:text-fg-on-accent',
  // Square, icon-only ("add to cart" next to Buy now)
  icon: 'border border-line-default text-fg-primary hover:bg-fg-primary/10 aspect-square',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-control-sm px-10',
  md: 'h-control px-20',
  lg: 'h-control-lg px-30',
};

const iconSizes: Record<ButtonSize, string> = { sm: 'h-control-sm p-0', md: 'h-control p-0', lg: 'h-control-lg p-0' };

/** Classes for non-<button> elements that should look like a button (e.g. a router <Link>). */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', fullWidth = false): string {
  return cn(base, variants[variant], variant === 'icon' ? iconSizes[size] : sizes[size], fullWidth && 'w-full');
}
