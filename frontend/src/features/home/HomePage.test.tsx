import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { useGuestCartStore } from '@/features/cart/guestCartStore';
import type { ProductCardData } from '@/features/catalog/types';
import { apiPath, mockApi } from '@/test/mockApi';
import { renderApp } from '@/test/renderApp';
import { blockRegistry } from './blockRegistry';
import type { HomeLayoutBlock } from './types';

const product = (id: number, title = `Game ${id}`): ProductCardData => ({
  id, slug: `game-${id}`, title, type: 'game', platform: { slug: 'steam', name: 'Steam' }, region: { slug: 'global', name: 'Global' },
  cover_url: null, min_price_cents: 1999, currency: 'EUR', offers_count: 2, release_date: null,
});

const block = (key: string, type: string, title: string): HomeLayoutBlock => ({ key, type, title, endpoint: `/api/v1/home/blocks/${key}` });

const LAYOUT = [
  block('hero', 'hero_banner', 'Featured'),
  block('best-sellers', 'best_sellers', 'Best sellers'),
  block('future', 'not_built_yet', 'From the future'),
  block('top-deals', 'deals', 'Top deals'),
  block('platforms', 'platform_tiles', 'Shop by platform'),
];

const PAYLOADS: Record<string, object> = {
  hero: { items: [
    { id: 1, title: 'Game keys for less', subtitle: 'Compare offers.', theme: 'violet', image_url: null, cta: { label: 'Browse the store', url: '/store' } },
    { id: 2, title: 'Big discounts', subtitle: null, theme: 'gold', image_url: null, cta: { label: 'See the deals', url: '/store?sort=price_asc' } },
  ] },
  'best-sellers': { items: [product(1, 'Elden Ring'), product(2, 'Hades')], see_all_url: '/store?sort=popular' },
  'top-deals': { items: [{ ...product(3, 'Cheap Game'), deal: { offer_id: 77, price_cents: 1000, original_price_cents: 4000, discount_percent: 75, seller_name: 'PixelVault' } }], see_all_url: '/store?sort=price_asc' },
  platforms: { items: [{ slug: 'steam', name: 'Steam', products_count: 116, url: '/store?platform=steam' }] },
};

type Behaviour = 'ok' | 'fail' | 'hang' | 'empty';

/** Mock /home and each block endpoint; `behaviour[key]` lets one block fail, hang or be empty. */
function setup(behaviour: Record<string, Behaviour> = {}, layout: HomeLayoutBlock[] = LAYOUT) {
  const requests = mockApi((url) => {
    const path = apiPath(url);
    if (path === '/home') return behaviour.layout === 'fail' ? { status: 500, body: { message: 'boom' } } : { body: { data: layout } };
    const key = /^\/home\/blocks\/(.+)$/.exec(path)?.[1];
    if (!key) return undefined;
    const b = behaviour[key] ?? 'ok';
    if (b === 'fail') return { status: 500, body: { message: 'Server Error' } };
    if (b === 'hang') return 'pending';
    const meta = layout.find((x) => x.key === key);
    return { body: { data: { key, type: meta?.type, title: meta?.title, ...(b === 'empty' ? { items: [], see_all_url: null } : PAYLOADS[key]) } } };
  });
  const view = renderApp('/');
  return { ...view, requests, blockRequests: () => requests.map(apiPath).filter((p) => p.startsWith('/home/blocks/')) };
}

afterEach(() => act(() => useGuestCartStore.getState().clear()));

describe('HomePage', () => {
  it('renders the blocks GET /home returns, in that order', async () => {
    setup();

    await screen.findByRole('heading', { name: 'Game keys for less' });
    await screen.findByRole('link', { name: 'Cheap Game' });
    expect(within(screen.getByRole('main')).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Game keys for less', 'Big discounts', 'Best sellers', 'Top deals', 'Shop by platform',
    ]);
  });

  it('each block fetches its own endpoint; unknown types render nothing and fetch nothing', async () => {
    const { blockRequests } = setup();
    await screen.findByRole('link', { name: 'Cheap Game' });

    expect(blockRequests().sort()).toEqual(['/home/blocks/best-sellers', '/home/blocks/hero', '/home/blocks/platforms', '/home/blocks/top-deals']);
    expect(screen.queryByText('From the future')).not.toBeInTheDocument();
  });

  it('one failing block shows a retry in place; the others still render', async () => {
    setup({ 'best-sellers': 'fail' });

    const failed = await screen.findByRole('alert');
    expect(failed).toHaveTextContent('Best sellers couldn’t load.');
    expect(screen.getByRole('link', { name: 'Cheap Game' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Game keys for less' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /steam\s*116 products/i })).toBeInTheDocument();
  });

  it('retrying a failed block refetches just that block', async () => {
    const behaviour: Record<string, Behaviour> = { 'best-sellers': 'fail' };
    const { blockRequests } = setup(behaviour);
    await screen.findByRole('alert');

    behaviour['best-sellers'] = 'ok';
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'Elden Ring' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(blockRequests().filter((p) => p.endsWith('/top-deals'))).toHaveLength(1);
  });

  it('a slow block shows its own skeleton while the rest render', async () => {
    const { container } = setup({ 'top-deals': 'hang' });

    expect(await screen.findByRole('link', { name: 'Elden Ring' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Game keys for less' })).toBeInTheDocument();
    // Deals is still loading: its skeleton (title placeholder, no heading, no cards) is in its slot.
    expect(screen.queryByRole('heading', { name: 'Top deals' })).not.toBeInTheDocument();
    const skeleton = [...container.querySelectorAll('[aria-hidden="true"]')].find((el) => el.textContent === 'Top deals');
    expect(skeleton).toBeDefined();
  });

  it('a block with no items renders nothing (no empty heading)', async () => {
    setup({ 'best-sellers': 'empty' });
    await screen.findByRole('link', { name: 'Cheap Game' });
    expect(screen.queryByRole('heading', { name: 'Best sellers' })).not.toBeInTheDocument();
  });

  it('"See all" links come from the backend', async () => {
    setup();
    expect(await screen.findByRole('link', { name: 'See all Best sellers' })).toHaveAttribute('href', '/store?sort=popular');
  });

  it('hero banners are our own themed gradients with text CTAs, no images', async () => {
    const { container } = setup();
    const main = (await screen.findByRole('heading', { name: 'Game keys for less' })).closest('article');
    if (!main) throw new Error('hero banner <article> missing');

    expect(main).toHaveAttribute('data-theme', 'violet');
    expect(main.className).toMatch(/bg-linear-to-br/);
    expect(within(main).getByRole('link', { name: 'Browse the store' })).toHaveAttribute('href', '/store');
    expect(container.querySelectorAll('article img')).toHaveLength(0);
  });

  it('deal cards add their offer to the cart', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /add to cart: cheap game/i }));
    expect(useGuestCartStore.getState().lines).toEqual([{ offerId: 77, quantity: 1 }]);
    expect(screen.getByText('-75%')).toBeInTheDocument();
  });

  it('shows a page-level error with retry when the layout itself fails', async () => {
    setup({ layout: 'fail' });
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load the homepage');
    expect(screen.getByRole('link', { name: 'Browse the store' })).toHaveAttribute('href', '/store');
  });
});

describe('blockRegistry', () => {
  it('covers every block type the backend registers (config/home.php)', () => {
    for (const type of ['hero_banner', 'best_sellers', 'deals', 'new_releases', 'by_platform', 'platform_tiles']) {
      expect(blockRegistry[type], type).toBeDefined();
    }
  });

  it('has no entry for unknown types', () => {
    expect(blockRegistry.not_built_yet).toBeUndefined();
  });
});
