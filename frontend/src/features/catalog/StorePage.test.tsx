import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiPath, mockApi } from '@/test/mockApi';
import { renderApp } from '@/test/renderApp';
import type { FacetOption, ProductCardData, ProductsResponse } from './types';

function product(id: number, overrides: Partial<ProductCardData> = {}): ProductCardData {
  return {
    id, slug: `game-${id}`, title: `Game ${id}`, type: 'game',
    platform: { slug: 'steam', name: 'Steam' }, region: { slug: 'global', name: 'Global' },
    cover_url: null, min_price_cents: 1000 + id, currency: 'EUR', offers_count: 2, release_date: null, ...overrides,
  };
}

const facet = (slug: string, name: string, count: number, selected = false): FacetOption => ({ slug, name, count, selected });

function response(url: URL, overrides: Partial<ProductsResponse['meta']> = {}, items = [product(1), product(2), product(3)]): ProductsResponse {
  const has = (key: string, slug: string) => (url.searchParams.get(key) ?? '').split(',').includes(slug);
  return {
    data: items,
    meta: {
      current_page: Number(url.searchParams.get('page') ?? 1), last_page: 3, per_page: 24, total: 60, from: 1, to: 24,
      facets: {
        platform: [facet('steam', 'Steam', 40, has('platform', 'steam')), facet('psn', 'PSN', 20, has('platform', 'psn'))],
        region: [facet('global', 'Global', 50, has('region', 'global')), facet('europe', 'Europe', 10, has('region', 'europe'))],
        genre: [facet('rpg', 'RPG', 30, has('genre', 'rpg'))],
      },
      price_range: { min: 199, max: 6999 }, did_you_mean: null, ...overrides,
    },
  };
}

const productRequests = (requests: URL[]) => requests.filter((u) => apiPath(u) === '/products');
const lastQuery = (requests: URL[]) => productRequests(requests).at(-1)?.searchParams;
const search = (router: ReturnType<typeof renderApp>['router']) => new URLSearchParams(router.state.location.search);
const sidebar = () => within(screen.getByRole('complementary', { name: 'Filters' }));

afterEach(() => vi.unstubAllGlobals());

describe('StorePage', () => {
  it('shows skeletons, then the results with count and cards', async () => {
    mockApi((url) => (apiPath(url) === '/products' ? { body: response(url) } : undefined));
    const { container } = renderApp('/store');

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Game 1' })).toHaveAttribute('href', '/product/game-1');
    expect(screen.getByText('Results found:')).toHaveTextContent('Results found: 60');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Buy game keys at the best price');
  });

  it('ticking a facet writes it to the URL, resets the page and refetches with it', async () => {
    const requests = mockApi((url) => ({ body: response(url) }));
    const { router } = renderApp('/store?page=2&sort=newest');

    await userEvent.click(await sidebar().findByRole('checkbox', { name: /steam/i }));

    await waitFor(() => expect(search(router).get('platform')).toBe('steam'));
    expect(search(router).get('page')).toBeNull();
    expect(search(router).get('sort')).toBe('newest');
    await waitFor(() => expect(lastQuery(requests)?.get('platform')).toBe('steam'));
    expect(sidebar().getByRole('checkbox', { name: /steam/i })).toBeChecked();
  });

  it('shows facet counts and the selected count badge', async () => {
    mockApi((url) => ({ body: response(url) }));
    renderApp('/store?platform=steam,psn');

    const platform = await sidebar().findByRole('button', { name: /platform/i });
    expect(platform).toHaveTextContent('2 selected');
    expect(sidebar().getByRole('checkbox', { name: /psn\s*20/i })).toBeChecked();
  });

  it('sort select updates the URL; "Best match" is only offered while searching', async () => {
    mockApi((url) => ({ body: response(url) }));
    const { router } = renderApp('/store');
    const sort = await screen.findByRole('combobox', { name: 'Sort by' });

    expect(within(sort).queryByRole('option', { name: 'Best match' })).not.toBeInTheDocument();
    await userEvent.selectOptions(sort, 'price_asc');
    await waitFor(() => expect(search(router).get('sort')).toBe('price_asc'));
  });

  it('pagination links keep the filters', async () => {
    mockApi((url) => ({ body: response(url) }));
    renderApp('/store?region=europe');

    expect(await screen.findByRole('link', { name: 'Page 2' })).toHaveAttribute('href', '/store?region=europe&page=2');
  });

  it('applies the price range in euros as cents, swapping reversed bounds', async () => {
    const requests = mockApi((url) => ({ body: response(url) }));
    const { router } = renderApp('/store');

    const minInput = await sidebar().findByRole('textbox', { name: 'Minimum price in euros' });
    expect(minInput).toHaveAttribute('placeholder', '1'); // price_range.min 199 → whole euros, rounded down
    expect(sidebar().getByRole('textbox', { name: 'Maximum price in euros' })).toHaveAttribute('placeholder', '70'); // 6999 → up
    await userEvent.type(minInput, '20');
    await userEvent.type(sidebar().getByRole('textbox', { name: 'Maximum price in euros' }), '9.99{Enter}');

    await waitFor(() => expect(search(router).get('price_min')).toBe('999'));
    expect(search(router).get('price_max')).toBe('2000');
    await waitFor(() => expect(lastQuery(requests)?.get('price_max')).toBe('2000'));
  });

  it('shows active filter chips; removing one or Clear all updates the URL (search text kept)', async () => {
    mockApi((url) => ({ body: response(url) }));
    const { router } = renderApp('/store?q=elden&platform=steam&region=north-america&price_max=2000&type=dlc');

    // Before data: readable slug; after: the facet name.
    expect(within(screen.getByRole('group', { name: 'Active filters' })).getByRole('button', { name: 'Remove filter: North america' })).toBeInTheDocument();
    await screen.findByRole('link', { name: 'Game 1' });
    const chips = within(screen.getByRole('group', { name: 'Active filters' }));
    expect(chips.getByRole('button', { name: 'Remove filter: Up to €20.00' })).toBeInTheDocument();
    expect(chips.getByRole('button', { name: 'Remove filter: DLC' })).toBeInTheDocument();

    await userEvent.click(chips.getByRole('button', { name: 'Remove filter: North america' }));
    await waitFor(() => expect(search(router).get('region')).toBeNull());
    expect(search(router).get('platform')).toBe('steam');

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(router.state.location.search).toBe('?q=elden'));
  });

  it('empty search shows "Did you mean" linking to the suggestion with filters kept', async () => {
    mockApi((url) => ({
      body: url.searchParams.get('q') === 'eldn rng' ? response(url, { total: 0, last_page: 1, did_you_mean: 'Elden Ring' }, []) : response(url),
    }));
    renderApp('/store?q=eldn+rng&platform=steam');

    expect(await screen.findByRole('heading', { name: 'No results for “eldn rng”' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elden Ring' })).toHaveAttribute('href', '/store?q=Elden+Ring&platform=steam');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for “eldn rng”');
  });

  it('empty filters without a suggestion offer Clear filters', async () => {
    mockApi((url) => ({ body: response(url, { total: 0, last_page: 1 }, []) }));
    const { router } = renderApp('/store?price_min=999999');

    await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('error state retries', async () => {
    let fail = true;
    mockApi((url) => (fail ? { status: 503, body: { message: 'Service Unavailable' } } : { body: response(url) }));
    renderApp('/store');

    expect(await screen.findByRole('alert')).toHaveTextContent('The server is having trouble');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Game 1' })).toBeInTheDocument();
  });

  it('mobile: Filters opens a drawer with the same filters, and closes from "Show N results"', async () => {
    const requests = mockApi((url) => ({ body: response(url) }));
    renderApp('/store?genre=rpg');

    await userEvent.click(await screen.findByRole('button', { name: 'Filters (1)' }));
    const drawer = within(screen.getByRole('dialog', { name: 'Filters' }));
    await userEvent.click(drawer.getByRole('checkbox', { name: /europe/i }));
    await waitFor(() => expect(lastQuery(requests)?.get('region')).toBe('europe'));

    await userEvent.click(drawer.getByRole('button', { name: 'Show 60 results' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('titles the page by type when filtering one type', async () => {
    mockApi((url) => ({ body: response(url) }));
    renderApp('/store?type=gift_card');
    expect(await screen.findByRole('heading', { level: 1, name: 'eGift Cards' })).toBeInTheDocument();
  });
});
