import { cn } from '@/lib/cn';
import { discountPercent, formatMoney } from '@/lib/money';

export interface PriceTagProps {
  priceCents: number;
  /** "Was" price. When higher than priceCents the discounted variant is shown. */
  originalPriceCents?: number | null;
  currency?: string;
  /** Small label above the price, e.g. "From" on product cards. */
  label?: string;
  size?: 'lg' | 'xl';
  className?: string;
}

/** Price with optional "-52% €49.99" discount line. Default = card price (22px), xl = featured/total (30px). */
export function PriceTag({ priceCents, originalPriceCents, currency = 'EUR', label, size = 'lg', className }: PriceTagProps) {
  const percent = discountPercent(priceCents, originalPriceCents);
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {label && <span className="text-caption text-fg-muted">{label}</span>}
      {percent !== null && originalPriceCents && (
        <span className="flex items-baseline gap-5 text-label">
          <span className="text-success">-{percent}%</span>
          <s className="text-fg-muted">
            <span className="sr-only">Was </span>
            {formatMoney(originalPriceCents, currency)}
          </s>
        </span>
      )}
      <span className={cn('text-fg-primary', size === 'xl' ? 'text-price-xl' : 'text-price-lg')}>
        {percent !== null && <span className="sr-only">Now </span>}
        {formatMoney(priceCents, currency)}
      </span>
    </div>
  );
}
