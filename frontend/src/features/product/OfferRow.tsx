import { Badge, Button, StarIcon, VerifiedIcon } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import type { Offer } from './types';

const nf = new Intl.NumberFormat('en-IE');

/** One seller's offer: who sells it, how trusted they are, price, and Add to cart. */
export function OfferRow({ offer, isLowest, productTitle, onAdd }: { offer: Offer; isLowest: boolean; productTitle: string; onAdd: () => void }) {
  const { seller } = offer;
  return (
    <li className="flex flex-wrap items-center gap-x-15 gap-y-12 bg-canvas-header p-20">
      {/* Two halves that wrap: seller on its own line on phones, price + button below. */}
      <div className="flex min-w-[240px] flex-1 items-center gap-15">
        <span aria-hidden="true" className="flex size-[40px] shrink-0 items-center justify-center rounded-full bg-surface-tab text-label text-fg-primary">
          {seller.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col gap-5">
          <span className="flex items-center gap-5 text-body text-fg-primary">
            {seller.name}
            {seller.is_verified && <VerifiedIcon className="size-icon-sm text-success" aria-label="Verified seller" />}
          </span>
          <span className="flex flex-wrap items-center gap-5 text-body-sm text-fg-secondary">
            <StarIcon className="size-icon-sm text-accent" />
            <strong className="text-fg-primary">{seller.rating.toFixed(2)}</strong>
            <span>/ 5 · {nf.format(seller.reviews_count)} reviews</span>
          </span>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-15">
        <div className="flex flex-col items-end gap-5">
          <span className="text-h2-sm text-fg-primary">{formatMoney(offer.price_cents, offer.currency)}</span>
          <span className="flex items-center gap-5">
            {offer.discount_percent !== null && <span className="text-label text-success">-{offer.discount_percent}%</span>}
            {isLowest && <Badge variant="lowestPrice" />}
          </span>
          {offer.available_stock <= 3 && <span className="text-body-sm text-fg-region">Only {offer.available_stock} left</span>}
        </div>
        <Button variant="secondary" size="sm" onClick={onAdd} aria-label={`Add to cart: ${productTitle} from ${seller.name}`}>
          Add to cart
        </Button>
      </div>
    </li>
  );
}
