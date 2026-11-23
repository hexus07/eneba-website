import { EMPTY_PARAMS, hasActiveFilters, parseCatalogParams, toApiQuery, toSearchParams, toggleValue, updateParams } from './catalogParams';

const parse = (qs: string) => parseCatalogParams(new URLSearchParams(qs));

describe('catalogParams', () => {
  it('parses every key, CSV lists de-duplicated', () => {
    expect(parse('q=+elden+&platform=steam,psn,steam&region=global&genre=rpg&type=game,dlc&price_min=500&price_max=2000&sort=price_asc&page=3')).toEqual({
      q: 'elden', platform: ['steam', 'psn'], region: ['global'], genre: ['rpg'], type: ['game', 'dlc'],
      priceMin: 500, priceMax: 2000, sort: 'price_asc', page: 3,
    });
  });

  it('drops invalid values instead of sending them to the API', () => {
    expect(parse('sort=cheapest&page=-2&price_min=abc&price_max=1.5&type=game,console')).toEqual({
      ...EMPTY_PARAMS, type: ['game'],
    });
    expect(parse('page=0').page).toBe(1);
  });

  it('round-trips through a canonical query string without defaults', () => {
    const qs = 'q=hades&platform=steam,gog&price_max=1500&sort=newest&page=2';
    expect(toSearchParams(parse(qs)).toString()).toBe('q=hades&platform=steam%2Cgog&price_max=1500&sort=newest&page=2');
    expect(toSearchParams(EMPTY_PARAMS).toString()).toBe('');
  });

  it('same state in any key order gives the same API query (one cache entry)', () => {
    expect(toApiQuery(parse('region=europe&q=x'))).toBe(toApiQuery(parse('q=x&region=europe')));
    expect(toApiQuery(EMPTY_PARAMS)).toBe('per_page=24');
  });

  it('resets to page 1 on any change except paging', () => {
    const onPage3 = { ...EMPTY_PARAMS, page: 3 };
    expect(updateParams(onPage3, { platform: ['steam'] }).page).toBe(1);
    expect(updateParams(onPage3, { sort: 'newest' }).page).toBe(1);
    expect(updateParams(onPage3, { page: 4 }).page).toBe(4);
  });

  it('toggles list values and detects active filters', () => {
    expect(toggleValue(['steam'], 'psn')).toEqual(['steam', 'psn']);
    expect(toggleValue(['steam', 'psn'], 'steam')).toEqual(['psn']);
    expect(hasActiveFilters(EMPTY_PARAMS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_PARAMS, q: 'x', sort: 'newest' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_PARAMS, priceMin: 0 })).toBe(true);
  });
});
