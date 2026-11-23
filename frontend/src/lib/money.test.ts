import { discountPercent, eurosToCents, formatMoney } from './money';

describe('formatMoney', () => {
  it('formats integer cents in EUR by default', () => {
    expect(formatMoney(1999)).toBe('€19.99');
    expect(formatMoney(0)).toBe('€0.00');
    expect(formatMoney(123456)).toBe('€1,234.56');
  });

  it('supports other currencies and locales', () => {
    expect(formatMoney(1999, 'USD', 'en-US')).toBe('$19.99');
    expect(formatMoney(1999, 'EUR', 'de-DE')).toBe('19,99\u00a0€'); // Intl uses a non-breaking space
  });

  it('rejects non-integer amounts (money is always cents)', () => {
    expect(() => formatMoney(19.99)).toThrow(TypeError);
  });
});

describe('discountPercent', () => {
  it('returns the whole-percent discount', () => {
    expect(discountPercent(1500, 6000)).toBe(75);
    expect(discountPercent(2949, 5999)).toBe(51); // 50.84 → 51, same as the API's round()
  });

  it('is null without a real discount', () => {
    expect(discountPercent(1000, null)).toBeNull();
    expect(discountPercent(1000, undefined)).toBeNull();
    expect(discountPercent(1000, 1000)).toBeNull();
    expect(discountPercent(1000, 900)).toBeNull();
  });
});

describe('eurosToCents', () => {
  it('parses dot or comma decimals and rounds to whole cents', () => {
    expect(eurosToCents('12.5')).toBe(1250);
    expect(eurosToCents(' 12,50 ')).toBe(1250);
    expect(eurosToCents('0.105')).toBe(11); // float noise rounded, not truncated
    expect(eurosToCents('0')).toBe(0);
  });

  it('returns null for empty, negative or non-numeric input', () => {
    for (const v of ['', '  ', '-1', 'abc', '1e', 'Infinity']) expect(eurosToCents(v)).toBeNull();
  });
});
