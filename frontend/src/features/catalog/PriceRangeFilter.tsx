import { useState, type SubmitEvent } from 'react';
import { TextInput } from '@/components/ui';
import { eurosToCents } from '@/lib/money';

const centsToEuros = (cents: number | null) => (cents === null ? '' : String(cents / 100));

export interface PriceRangeFilterProps {
  min: number | null;
  max: number | null;
  /** Span of the current results, shown as placeholders. */
  available: { min: number | null; max: number | null };
  onApply: (min: number | null, max: number | null) => void;
}

/**
 * Two euro inputs (placeholders: the results' span in whole euros, rounded outward, so they fit); the URL (and API) keep cents. Applies on Enter or when focus leaves the group.
 * Mount with `key` = the applied values so external changes (Clear all, Back) reset the draft.
 */
export function PriceRangeFilter({ min, max, available, onApply }: PriceRangeFilterProps) {
  const [draftMin, setDraftMin] = useState(centsToEuros(min));
  const [draftMax, setDraftMax] = useState(centsToEuros(max));

  const apply = () => {
    let lo = eurosToCents(draftMin);
    let hi = eurosToCents(draftMax);
    if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo]; // forgive swapped inputs
    if (lo !== min || hi !== max) onApply(lo, hi);
  };

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    apply();
  };

  return (
    <section className="px-20 py-15">
      <h3 className="text-h2-sm text-fg-primary">Price range (EUR)</h3>
      <form
        onSubmit={submit}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) apply();
        }}
        className="mt-15 flex items-center gap-8"
      >
        <TextInput
          label="Minimum price in euros"
          hideLabel
          tone="raised"
          inputMode="decimal"
          value={draftMin}
          onChange={(e) => setDraftMin(e.target.value)}
          placeholder={available.min === null ? 'Min' : String(Math.floor(available.min / 100))}
          className="flex-1"
        />
        <span aria-hidden="true" className="text-fg-primary">–</span>
        <TextInput
          label="Maximum price in euros"
          hideLabel
          tone="raised"
          inputMode="decimal"
          value={draftMax}
          onChange={(e) => setDraftMax(e.target.value)}
          placeholder={available.max === null ? 'Max' : String(Math.ceil(available.max / 100))}
          className="flex-1"
        />
        <button type="submit" className="sr-only">Apply price range</button>
      </form>
    </section>
  );
}
