import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CashbackIcon } from './icons';

export type BadgeVariant = 'cashback' | 'cashbackDeal' | 'bestCashback' | 'lowestPrice';

const variants: Record<BadgeVariant, string> = {
  // Solid teal tag on card covers ("CASHBACK")
  cashback: 'bg-accent-cashback text-fg-on-accent text-badge uppercase px-5 py-5 gap-4',
  // Outlined teal pill above the product title ("Cashback deal")
  cashbackDeal: 'border border-accent-cashback text-accent-cashback text-label rounded-full px-12 py-2',
  // Small lime pill next to a cashback amount ("Best cashback")
  bestCashback: 'border border-fg-cashback text-fg-cashback text-badge rounded-full px-5 py-2',
  // White outline pill on the cheapest offer ("Lowest price")
  lowestPrice: 'border border-line-default text-fg-primary text-badge rounded-md px-8 py-2',
};

const defaultLabels: Record<BadgeVariant, string> = {
  cashback: 'Cashback',
  cashbackDeal: 'Cashback deal',
  bestCashback: 'Best cashback',
  lowestPrice: 'Lowest price',
};

export function Badge({ variant, children, className }: { variant: BadgeVariant; children?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex w-fit items-center whitespace-nowrap', variants[variant], className)}>
      {variant === 'cashback' && <CashbackIcon className="size-icon-sm" />}
      {children ?? defaultLabels[variant]}
    </span>
  );
}
