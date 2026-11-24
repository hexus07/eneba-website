import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGuestCartStore } from '@/features/cart/guestCartStore';
import type { ProductCardData } from '@/features/catalog/types';
import { apiPath, mockApi } from '@/test/mockApi';
import { renderApp } from '@/test/renderApp';
import type { Offer, ProductDetail } from './types';

const seller = (name: string, overrides: Partial<Offer['seller']> = {}): Offer['seller'] => ({
  slug: name.toLowerCase(), name, rating: 4.9, reviews_count: 12345, is_verified: false, ...overrides,
});

function offer(id: number, price: number, overrides: Partial<Offer> = {}): Offer {
  return { id, price_cents: price, original_price_cents: null, discount_percent: null, currency: 'EUR', available_stock: 10, seller: seller(`Seller${id}`), ...overrides };
}

function product(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: 1, slug: 'elden-ring-steam-global', title: 'Elden Ring', type: 'game',
    platform: { slug: 'steam', name: 'Steam' }, region: { slug: 'global', name: 'Global' },
    cover_url: null, min_price_cents: 2949, currency: 'EUR', offers_count: 3, release_date: '2022-02-25',
    description: 'Rise, Tarnished.', developer: 'FromSoftware', publisher: 'Bandai Namco',
    genres: [{ slug: 'rpg', name: 'RPG' }, { slug: 'action', name: 'Action' }],
    offers: [
      offer(11, 2949, { original_price_cents: 5999, discount_percent: 51, seller: seller('LootLane', { is_verified: true, rating: 4.81 }) }),
      offer(12, 3284, { seller: seller('PixelVault') }),
      offer(13, 3500, { available_stock: 2, seller: seller('CodeCrate') }),
    ],
    variants: [
      { slug: 'elden-ring-psn-europe', platform: { slug: 'psn', name: 'PSN' }, region: { slug: 'europe', name: 'Europe' }, min_price_cents: 2742, offers_count: 2 },
      { slug: 'elden-ring-xbox-na', platform: { slug: 'xbox', name: 'Xbox Live' }, region: { slug: 'north-america', name: 'North America' }, min_price_cents: null, offers_count: 0 },
    ],
    ...overrides,
  };
}

const card = (id: number, title: string, offers = 2): ProductCardData => ({
  id, slug: `p-${id}`, title, type: 'game', platform: { slug: 'steam', name: 'Steam' }, region: { slug: 'global', name: 'Global' },
  cover_url: null, min_price_cents: 1000, currency: 'EUR', offers_count: offers, release_date: null,
});

function setup(detail: ProductDetail | 'missing' | 'error' = product(), related: ProductCardData[] = [card(2, 'Dark Souls III'), card(3, 'Elden Ring'), card(4, 'Sekiro'), card(5, 'Lies of P', 0)]) {
  const requests = mockApi((url) => {
    const path = apiPath(url);
    if (path.startsWith('/products/')) {
      if (detail === 'missing') return { status: 404, body: { message: 'Not Found' } };
      if (detail === 'error') return { status: 500, body: { message: 'boom' } };
      return { body: { data: detail } };
    }
    if (path === '/products') return { body: { data: related, meta: {} } };
    return undefined;
  });
  return { requests, ...renderApp('/product/elden-ring-steam-global') };
}

afterEach(() => act(() => useGuestCartStore.getState().clear()));

describe('ProductPage', () => {
  it('shows breadcrumbs, title, platform/region and the facts', async () => {
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Elden Ring' })).toBeInTheDocument();
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs.getByRole('link', { name: 'Steam' })).toHaveAttribute('href', '/store?platform=steam');
    expect(crumbs.getByText('Elden Ring')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Can be activated worldwide')).toBeInTheDocument();
  });

  it('features the cheapest offer and adds it to the cart', async () => {
    setup();
    const best = within(await screen.findByRole('complementary', { name: 'Best offer' }));

    expect(best.getByText('€29.49')).toBeInTheDocument();
    expect(best.getByText('-51%')).toBeInTheDocument();
    expect(best.getByText('LootLane')).toBeInTheDocument();
    expect(best.getByRole('link', { name: '+2 other offers' })).toHaveAttribute('href', '#offers');

    await userEvent.click(best.getByRole('button', { name: 'Add to cart' }));
    expect(useGuestCartStore.getState().lines).toEqual([{ offerId: 11, quantity: 1 }]);
  });

  it('compares sellers: rating, verified, price, lowest-price badge on the cheapest only, low stock', async () => {
    setup();
    const list = within(await screen.findByRole('region', { name: '3 offers' }));
    const rows = list.getAllByRole('listitem');
    const row = (i: number) => {
      const el = rows[i];
      if (!el) throw new Error(`no offer row ${i}`);
      return within(el);
    };

    expect(rows).toHaveLength(3);
    expect(row(0).getByText('Lowest price')).toBeInTheDocument();
    expect(row(1).queryByText('Lowest price')).not.toBeInTheDocument();
    expect(row(0).getByRole('img', { name: 'Verified seller' })).toBeInTheDocument();
    expect(row(1).queryByRole('img', { name: 'Verified seller' })).not.toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('4.81/ 5 · 12,345 reviews');
    expect(rows[2]).toHaveTextContent('Only 2 left');

    await userEvent.click(list.getByRole('button', { name: 'Add to cart: Elden Ring from PixelVault' }));
    expect(useGuestCartStore.getState().lines).toEqual([{ offerId: 12, quantity: 1 }]);
  });

  it('a single offer gets no "lowest price" badge', async () => {
    setup(product({ offers: [offer(11, 2949)] }));
    await screen.findByRole('region', { name: '1 offer' });
    expect(screen.queryByText('Lowest price')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /other offer/ })).not.toBeInTheDocument();
  });

  it('switches between platform/region versions', async () => {
    setup();
    const versions = within(await screen.findByRole('region', { name: 'Other versions' }));

    expect(versions.getByRole('link', { name: /steam · global/i })).toHaveAttribute('aria-current', 'page');
    expect(versions.getByRole('link', { name: /psn · europe\s*from €27\.42/i })).toHaveAttribute('href', '/product/elden-ring-psn-europe');
    expect(versions.getByRole('link', { name: /xbox live · north america\s*out of stock/i })).toBeInTheDocument();
  });

  it('shows the description, details and genre links', async () => {
    setup();
    const description = within(await screen.findByRole('region', { name: 'Description' }));
    expect(description.getByText('Rise, Tarnished.')).toBeInTheDocument();
    expect(description.getByText('FromSoftware')).toBeInTheDocument();
    expect(description.getByText('25 February 2022')).toBeInTheDocument();
    expect(description.getByRole('link', { name: 'RPG' })).toHaveAttribute('href', '/store?genre=rpg');
  });

  it('"Gamers also viewed": same genre, popular, without this title or out-of-stock products', async () => {
    const { requests } = setup();
    const section = within(await screen.findByRole('region', { name: 'Gamers also viewed' }));

    await waitFor(() => expect(section.getAllByRole('article')).toHaveLength(2));
    expect(section.getByRole('link', { name: 'Dark Souls III' })).toBeInTheDocument();
    expect(section.getByRole('link', { name: 'Sekiro' })).toBeInTheDocument();
    const query = requests.find((u) => apiPath(u) === '/products')?.searchParams;
    expect(query?.get('genre')).toBe('rpg');
    expect(query?.get('sort')).toBe('popular');
  });

  it('out of stock: says so and points to another version', async () => {
    setup(product({ offers: [], offers_count: 0 }));
    const best = within(await screen.findByRole('complementary', { name: 'Best offer' }));
    expect(best.getByText('Currently out of stock')).toBeInTheDocument();
    expect(best.getByText('Another version below is available.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /offers?$/ })).not.toBeInTheDocument();
  });

  it('404: product not found', async () => {
    setup('missing');
    expect(await screen.findByRole('heading', { name: 'Product not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the store' })).toHaveAttribute('href', '/store');
  });

  it('error: retry', async () => {
    setup('error');
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load this product');
  });

  it('loading: skeleton while the product loads', () => {
    mockApi(() => 'pending');
    const { container } = renderApp('/product/elden-ring-steam-global');
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});
