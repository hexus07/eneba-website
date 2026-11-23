import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '@/features/auth/authStore';
import { apiPath, mockApi } from '@/test/mockApi';
import { renderApp } from '@/test/renderApp';
import { useGuestCartStore } from './guestCartStore';
import type { Cart, CartLine } from './types';

const ada = { id: 1, name: 'Ada', email: 'ada@example.com', created_at: '' };

function line(offerId: number, quantity: number, overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: null, offer_id: offerId, quantity, unit_price_cents: 1500, line_total_cents: 1500 * quantity, currency: 'EUR',
    available_stock: 5, is_purchasable: true,
    product: { slug: `game-${offerId}`, title: `Game ${offerId}`, cover_url: null, platform: { slug: 'steam', name: 'Steam' }, region: { slug: 'global', name: 'Global' } },
    seller: { slug: 'pixelvault', name: 'PixelVault', rating: 4.9 },
    ...overrides,
  };
}

function cart(...lines: CartLine[]): Cart {
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  return {
    items: lines,
    totals: { items_count: count, subtotal_cents: lines.reduce((n, l) => n + l.line_total_cents, 0), currency: 'EUR', is_purchasable: lines.length > 0 && lines.every((l) => l.is_purchasable) },
  };
}

/** Guest preview mirrors the posted lines (so quantity edits show up). */
function guestApi(overrides: (l: { offer_id: number; quantity: number }) => Partial<CartLine> = () => ({})) {
  const calls: string[] = [];
  mockApi((url) => {
    calls.push(apiPath(url));
    if (apiPath(url) !== '/cart/preview') return undefined;
    const body = vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body;
    const lines = (typeof body === 'string' ? (JSON.parse(body) as { items: { offer_id: number; quantity: number }[] }).items : []);
    return { body: { data: cart(...lines.map((l) => line(l.offer_id, l.quantity, overrides(l)))) } };
  });
  return calls;
}

afterEach(() => act(() => {
  useAuthStore.getState().clear();
  useGuestCartStore.getState().clear();
}));

describe('CartPage (guest)', () => {
  it('prices the guest cart live and shows items, seller and totals', async () => {
    act(() => {
      useGuestCartStore.getState().add(1, 2);
      useGuestCartStore.getState().add(2, 1);
    });
    const calls = guestApi();
    renderApp('/cart');

    expect(await screen.findByRole('heading', { level: 1, name: 'My cart' })).toBeInTheDocument();
    expect(screen.getAllByText('PixelVault')).toHaveLength(2);
    expect(screen.getByText('3 products')).toBeInTheDocument();
    expect(screen.getByText('€30.00')).toBeInTheDocument(); // line 1: 2 × €15
    expect(within(screen.getByRole('region', { name: 'Summary' })).getAllByText('€45.00')).toHaveLength(2);
    expect(calls).toEqual(['/cart/preview']);
  });

  it('quantity and remove edit the local cart and re-price', async () => {
    act(() => useGuestCartStore.getState().add(1, 1));
    guestApi();
    renderApp('/cart');

    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity of Game 1' }));
    await waitFor(() => expect(useGuestCartStore.getState().lines).toEqual([{ offerId: 1, quantity: 2 }]));
    expect(await screen.findByText('2 products')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /remove game 1/i }));
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the store' })).toHaveAttribute('href', '/store');
  });

  it('blocks checkout while a line is sold out or above stock, and says why', async () => {
    act(() => {
      useGuestCartStore.getState().add(1, 3);
      useGuestCartStore.getState().add(2, 1);
    });
    guestApi((l) => (l.offer_id === 1 ? { available_stock: 2, is_purchasable: false } : { available_stock: 0, is_purchasable: false }));
    renderApp('/cart');

    expect(await screen.findByText('Only 2 left. Lower the quantity to continue.')).toBeInTheDocument();
    expect(screen.getByText('Sold out or no longer offered. Remove it to continue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proceed to checkout' })).toBeDisabled();
    expect(screen.getByText('Fix the items marked in your cart to continue.')).toBeInTheDocument();
  });

  it('flags region-locked keys', async () => {
    act(() => useGuestCartStore.getState().add(1, 1));
    guestApi(() => ({ product: { ...line(1, 1).product, region: { slug: 'europe', name: 'Europe' } } }));
    renderApp('/cart');
    expect(await screen.findByText(/region-locked key \(europe\)/i)).toBeInTheDocument();
  });

  it('proceeding as a guest goes through login and comes back to checkout', async () => {
    act(() => useGuestCartStore.getState().add(1, 1));
    guestApi();
    const { router } = renderApp('/cart');

    await userEvent.click(await screen.findByRole('button', { name: 'Proceed to checkout' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?redirect=%2Fcheckout');
  });

  it('shows the empty state without any request', async () => {
    const calls = guestApi();
    renderApp('/cart');
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    expect(calls).toEqual([]);
  });
});

describe('CartPage (signed in)', () => {
  it('uses the server cart; quantity and remove call the API', async () => {
    act(() => useAuthStore.getState().setSession('1|t', ada));
    let current = cart(line(1, 1, { id: 10 }));
    const calls: { path: string; method: string | undefined; body: unknown }[] = [];
    mockApi((url) => {
      const init = vi.mocked(fetch).mock.calls.at(-1)?.[1];
      calls.push({ path: apiPath(url), method: init?.method, body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined });
      if (apiPath(url) === '/cart/items/10' && init?.method === 'PATCH') current = cart(line(1, 2, { id: 10 }));
      if (apiPath(url) === '/cart/items/10' && init?.method === 'DELETE') current = cart();
      return apiPath(url).startsWith('/cart') ? { body: { data: current } } : undefined;
    });
    renderApp('/cart');

    expect(await screen.findByText(/ada@example\.com/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity of Game 1' }));
    expect(await screen.findByText('2 products')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')).toEqual({ path: '/cart/items/10', method: 'PATCH', body: { quantity: 2 } });

    await userEvent.click(screen.getByRole('button', { name: /remove game 1/i }));
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/cart/preview')).toEqual([]);
  });

  it('proceeds straight to checkout', async () => {
    act(() => useAuthStore.getState().setSession('1|t', ada));
    mockApi((url) => (apiPath(url) === '/cart' ? { body: { data: cart(line(1, 1, { id: 10 })) } } : undefined));
    const { router } = renderApp('/cart');

    await userEvent.click(await screen.findByRole('button', { name: 'Proceed to checkout' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/checkout'));
  });

  it('shows an error with retry when the cart fails to load', async () => {
    act(() => useAuthStore.getState().setSession('1|t', ada));
    let fail = true;
    mockApi((url) => (apiPath(url) === '/cart' ? (fail ? { status: 500, body: { message: 'x' } } : { body: { data: cart(line(1, 1, { id: 10 })) } }) : undefined));
    renderApp('/cart');

    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load your cart');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'My cart' })).toBeInTheDocument();
  });
});
