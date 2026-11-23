import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiPath, mockApi } from '@/test/mockApi';
import { renderApp } from '@/test/renderApp';
import type { Suggestion } from './api';
import { SUGGEST_DEBOUNCE_MS } from './SearchBox';

// Real timers here: Testing Library's waitFor doesn't drive Vitest's fake timers. The debounce
// timing itself is unit-tested with fake timers in lib/useDebouncedValue.test.ts.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const suggestion = (slug: string, title: string, price: number | null = 2999): Suggestion => ({
  slug, title, cover_url: null, min_price_cents: price, currency: 'EUR', platform: { slug: 'steam', name: 'Steam' },
});

function setup(path = '/') {
  const requests = mockApi((url) => {
    if (apiPath(url) === '/search/suggest') {
      const q = url.searchParams.get('q') ?? '';
      return { body: { data: q.startsWith('eld') ? [suggestion('elden-ring-steam-global', 'Elden Ring'), suggestion('elden-dlc', 'Elden Ring: Shadow of the Erdtree', null)] : [] } };
    }
    return undefined;
  });
  const user = userEvent.setup();
  const view = renderApp(path);
  // Desktop instance (the mobile one is identical, just a different id).
  const input = screen.getAllByRole('combobox', { name: 'Search for games, top-ups and more' })[0];
  if (!input) throw new Error('no search combobox');
  const suggestCalls = () => requests.filter((u) => apiPath(u) === '/search/suggest').map((u) => u.searchParams.get('q'));
  return { ...view, user, input, suggestCalls };
}

const listbox = () => {
  const [el] = screen.getAllByRole('listbox', { hidden: true });
  if (!el) throw new Error('no listbox');
  return el;
};

afterEach(() => vi.unstubAllGlobals());

describe('SearchBox', () => {
  it('debounces: a burst of keystrokes makes one request; 1 character makes none', async () => {
    const { user, input, suggestCalls } = setup();

    await user.type(input, 'e');
    await wait(SUGGEST_DEBOUNCE_MS + 100);
    expect(suggestCalls()).toEqual([]);

    await user.type(input, 'ld'); // without the debounce: requests for "el" and "eld"
    expect(await within(listbox()).findByRole('option', { name: 'Elden Ring, Steam, €29.99' })).toBeInTheDocument();
    expect(suggestCalls()).toEqual(['eld']);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('arrow keys move the highlight (aria-activedescendant) and Enter opens the product', async () => {
    const { user, input, router } = setup();
    await user.type(input, 'eld');
    await within(listbox()).findByRole('option', { name: 'Elden Ring, Steam, €29.99' });

    await user.keyboard('{ArrowDown}');
    const first = within(listbox()).getByRole('option', { name: 'Elden Ring, Steam, €29.99' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', first.id);

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}'); // 2nd, "See all", wraps to 1st
    expect(first).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}'); // wraps to "See all"
    expect(within(listbox()).getByRole('option', { name: 'See all results for “eld”' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{ArrowUp}{Enter}');

    expect(router.state.location.pathname).toBe('/product/elden-ring-steam-global');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('Enter with nothing highlighted goes to the store search', async () => {
    const { user, input, router } = setup();
    await user.type(input, 'elden ring{Enter}');

    expect(router.state.location.pathname).toBe('/store');
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('elden ring');
  });

  it('Esc closes the list without clearing the text', async () => {
    const { user, input } = setup();
    await user.type(input, 'eld');
    await within(listbox()).findByRole('option', { name: 'Elden Ring, Steam, €29.99' });

    await user.keyboard('{Escape}');

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(listbox()).not.toBeVisible();
    expect(input).toHaveValue('eld');
  });

  it('clicking a suggestion opens it; "See all" opens the store search', async () => {
    const { user, input, router } = setup();
    await user.type(input, 'eld');

    await user.click(await within(listbox()).findByRole('option', { name: /shadow of the erdtree/i }));
    expect(router.state.location.pathname).toBe('/product/elden-dlc');
  });

  it('shows "No matches" and still offers the store search', async () => {
    const { user, input } = setup();
    await user.type(input, 'zzq');

    expect(await within(listbox()).findByText('No matches for “zzq”')).toBeInTheDocument();
    expect(within(listbox()).getByRole('option', { name: 'See all results for “zzq”' })).toBeInTheDocument();
  });

  it('out-of-stock suggestions say so instead of a price', async () => {
    const { user, input } = setup();
    await user.type(input, 'eld');
    expect(await within(listbox()).findByRole('option', { name: 'Elden Ring: Shadow of the Erdtree, Steam, out of stock' })).toBeInTheDocument();
  });

  it('on /store the box shows the current search query', () => {
    setup('/store?q=hades&platform=steam');
    expect(screen.getAllByRole('combobox', { name: 'Search for games, top-ups and more' })[0]).toHaveValue('hades');
  });
});

describe('SearchBox thumbnails', () => {
  it('fall back from a missing portrait capsule to the header image, then to nothing', async () => {
    const portrait = 'https://cdn.akamai.steamstatic.com/steam/apps/2778580/library_600x900.jpg';
    mockApi((url) => (apiPath(url) === '/search/suggest'
      ? { body: { data: [{ ...suggestion('dlc', 'Shadow of the Erdtree'), cover_url: portrait }] } }
      : undefined));
    const user = userEvent.setup();
    renderApp('/');
    const [input] = screen.getAllByRole('combobox', { name: 'Search for games, top-ups and more' });
    if (!input) throw new Error('no search combobox');

    await user.type(input, 'shadow');
    const option = await within(listbox()).findByRole('option', { name: /shadow of the erdtree/i });
    const img = () => option.querySelector('img');

    expect(img()).toHaveAttribute('src', portrait);
    const first = img();
    if (first) fireEvent.error(first);
    expect(img()).toHaveAttribute('src', 'https://cdn.akamai.steamstatic.com/steam/apps/2778580/header.jpg');
    const second = img();
    if (second) fireEvent.error(second);
    expect(img()).toBeNull();
  });
});
