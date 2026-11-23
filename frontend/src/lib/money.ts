/**
 * All money in the app is integer minor units (cents) + ISO currency, as returned by the API.
 * Only this module turns it into text.
 */
const DEFAULT_LOCALE = 'en-IE';
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, locale: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: 'currency', currency });
    formatters.set(key, f);
  }
  return f;
}

/** 1999 → "€19.99" */
export function formatMoney(cents: number, currency = 'EUR', locale = DEFAULT_LOCALE): string {
  if (!Number.isInteger(cents)) throw new TypeError(`formatMoney expects integer cents, got ${cents}`);
  return formatter(currency, locale).format(cents / 100);
}

/**
 * Whole-percent discount of `priceCents` vs `originalCents`, or null when there is no real discount.
 * Rounds half up, matching the backend's PHP round() for positive values.
 */
export function discountPercent(priceCents: number, originalCents: number | null | undefined): number | null {
  if (!originalCents || originalCents <= priceCents) return null;
  return Math.round((100 * (originalCents - priceCents)) / originalCents);
}
