/**
 * Join class names, skipping falsy values. It does NOT resolve conflicts (no tailwind-merge: with this
 * custom theme it can't tell `text-price-lg` (size) from `text-fg-primary` (color)). So never pass a
 * utility that a component already sets (display, font size…) via className: two conflicting classes are
 * decided by CSS order, not by the order written. Wrap the component or add a prop instead.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
