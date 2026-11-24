import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '@/features/auth/authStore';
import type { Order } from '@/features/orders/types';
import { useToastStore } from '@/lib/toastStore';
import { apiPath, mockApi } from '@/test/mockApi';
import { renderApp } from '@/test/renderApp';

const ada = { id: 1, name: 'Ada', email: 'ada@example.com', created_at: '' };
const ORDER_ID = '01a208e3-0000-7000-8000-000000000001';

const cartLine = {
  id: 10, offer_id: 5, quantity: 2, unit_price_cents: 1500, line_total_cents: 3000, currency: 'EUR', available_stock: 5, is_purchasable: true,
  product: { slug: 'hades-steam-global', title: 'Hades', cover_url: null, platform: { slug: 'steam', name: 'Steam' }, region: { slug: 'global', name: 'Global' } },
  seller: { slug: 'pv', name: 'PixelVault', rating: 4.9 },
};
const CART = { items: [cartLine], totals: { items_count: 2, subtotal_cents: 3000, currency: 'EUR', is_purchasable: true } };

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID, status: 'pending', total_cents: 3000, currency: 'EUR', payment_provider: 'fake', failure_reason: null,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), created_at: new Date().toISOString(), paid_at: null,
    items: [{ id: 1, product_slug: 'hades-steam-global', product_title: 'Hades', cover_url: null, platform_name: 'Steam', region_name: 'Global',
      seller_name: 'PixelVault', unit_price_cents: 1500, quantity: 2, line_total_cents: 3000, keys: [] }],
    ...overrides,
  };
}
const completed = () => order({
  status: 'completed',
  paid_at: new Date().toISOString(),
  items: order().items.map((item) => ({ ...item, keys: [{ id: 1, code: 'ABCDE-FGHIJ-KLMNO' }, { id: 2, code: 'PQRST-UVWXY-Z2345' }] })),
});

interface Call {
  path: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

function api(handler: (c: Call) => { status?: number; body: unknown } | undefined) {
  const calls: Call[] = [];
  mockApi((url) => {
    const init = vi.mocked(fetch).mock.calls.at(-1)?.[1];
    const call = { path: apiPath(url), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined, headers: (init?.headers ?? {}) as Record<string, string> };
    calls.push(call);
    return handler(call) ?? (call.path === '/cart' ? { body: { data: CART } } : undefined);
  });
  return calls;
}

beforeEach(() => act(() => useAuthStore.getState().setSession('1|t', ada)));
afterEach(() => act(() => {
  useAuthStore.getState().clear();
  useToastStore.setState({ toasts: [] });
}));

describe('CheckoutPage', () => {
  it('places the order with an Idempotency-Key and moves to payment (step 2)', async () => {
    const calls = api((c) => (c.path === '/checkout' ? { status: 201, body: { data: order(), payment: { provider: 'fake', confirm_url: 'x' } } } : c.path === `/orders/${ORDER_ID}` ? { body: { data: order() } } : undefined));
    const { router } = renderApp('/checkout');

    expect(await screen.findByRole('heading', { name: 'Review your order' })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Checkout progress' })).getByText('Payment').closest('li')).toHaveAttribute('aria-current', 'step');
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/checkout/pay/${ORDER_ID}`));
    const post = calls.find((c) => c.path === '/checkout');
    expect(post?.method).toBe('POST');
    expect(post?.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('retries with the same Idempotency-Key after a failure (no double order)', async () => {
    let attempt = 0;
    const calls = api((c) => {
      if (c.path !== '/checkout') return undefined;
      attempt++;
      return attempt === 1 ? { status: 503, body: { message: 'down' } } : { status: 201, body: { data: order(), payment: null } };
    });
    renderApp('/checkout');

    await userEvent.click(await screen.findByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('you won’t be charged twice');
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => expect(calls.filter((c) => c.path === '/checkout')).toHaveLength(2));
    const [first, second] = calls.filter((c) => c.path === '/checkout');
    expect(second?.headers['Idempotency-Key']).toBe(first?.headers['Idempotency-Key']);
  });

  it('explains what sold out (409) and links back to the cart', async () => {
    api((c) => (c.path === '/checkout' ? { status: 409, body: { message: 'Some items…', items: [{ offer_id: 5, reason: 'out_of_stock', requested: 2, available: 1 }] } } : undefined));
    renderApp('/checkout');

    await userEvent.click(await screen.findByRole('button', { name: 'Place order' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Hades: 1 left, you wanted 2');
    expect(within(alert).getByRole('link', { name: 'Update my cart' })).toHaveAttribute('href', '/cart');
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
  });

  it('sends an empty cart back to /cart', async () => {
    api((c) => (c.path === '/cart' ? { body: { data: { items: [], totals: { ...CART.totals, items_count: 0, is_purchasable: false } } } } : undefined));
    const { router } = renderApp('/checkout');
    await waitFor(() => expect(router.state.location.pathname).toBe('/cart'));
  });
});

describe('PaymentPage', () => {
  it('shows the reservation countdown; paying leads to the keys (step 3)', async () => {
    let paid = false;
    const calls = api((c) => {
      if (c.path === `/orders/${ORDER_ID}`) return { body: { data: paid ? completed() : order({ expires_at: new Date(Date.now() + 754_000).toISOString() }) } };
      if (c.path === `/checkout/${ORDER_ID}/confirm`) {
        paid = true;
        return { body: { data: completed() } };
      }
      return undefined;
    });
    const { router } = renderApp(`/checkout/pay/${ORDER_ID}`);

    expect(await screen.findByText(/^12:3\d$/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pay €30.00' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/checkout/done/${ORDER_ID}`));
    expect(calls.find((c) => c.path === `/checkout/${ORDER_ID}/confirm`)?.body).toEqual({ outcome: 'succeed' });
    expect(await screen.findByRole('heading', { name: 'Thank you! Here are your keys' })).toBeInTheDocument();
    expect(screen.getByText('Get your product').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('a declined payment explains that the keys were released', async () => {
    api((c) => (c.path === `/orders/${ORDER_ID}` ? { body: { data: order() } } : c.path === `/checkout/${ORDER_ID}/confirm` ? { body: { data: order({ status: 'failed', failure_reason: 'card_declined' }) } } : undefined));
    renderApp(`/checkout/pay/${ORDER_ID}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Simulate a declined payment' }));

    expect(await screen.findByRole('heading', { name: 'Payment declined' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to my cart' })).toHaveAttribute('href', '/cart');
  });

  it('an expired reservation (409 from confirm, or the clock) offers a new checkout', async () => {
    api((c) => (c.path === `/orders/${ORDER_ID}` ? { body: { data: order() } } : c.path === `/checkout/${ORDER_ID}/confirm` ? { status: 409, body: { message: 'Your reservation expired.', data: order({ status: 'expired' }) } } : undefined));
    renderApp(`/checkout/pay/${ORDER_ID}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Pay €30.00' }));
    expect(await screen.findByRole('heading', { name: 'Reservation expired' })).toBeInTheDocument();
  });

  it('treats a pending order past its expiry as expired without calling the API', async () => {
    const calls = api((c) => (c.path === `/orders/${ORDER_ID}` ? { body: { data: order({ expires_at: new Date(Date.now() - 1000).toISOString() }) } } : undefined));
    renderApp(`/checkout/pay/${ORDER_ID}`);

    expect(await screen.findByRole('heading', { name: 'Reservation expired' })).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/confirm'))).toBe(false);
  });
});

describe('Order keys', () => {
  it('are hidden until revealed, then copyable', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    api((c) => (c.path === `/orders/${ORDER_ID}` ? { body: { data: completed() } } : undefined));
    renderApp(`/checkout/done/${ORDER_ID}`);

    const keys = within(await screen.findByRole('list', { name: 'Keys for Hades' }));
    expect(keys.getAllByText('•••••-•••••-•••••')).toHaveLength(2);
    expect(screen.queryByText('ABCDE-FGHIJ-KLMNO')).not.toBeInTheDocument();

    await userEvent.click(keys.getByRole('button', { name: 'Reveal Hades key 1' }));
    expect(keys.getByText('ABCDE-FGHIJ-KLMNO')).toBeInTheDocument();
    await userEvent.click(keys.getByRole('button', { name: 'Copy Hades key 1' }));

    expect(writeText).toHaveBeenCalledWith('ABCDE-FGHIJ-KLMNO');
    await waitFor(() => expect(useToastStore.getState().toasts[0]?.message).toBe('Key copied to the clipboard'));
    expect(keys.getByRole('button', { name: 'Reveal Hades key 2' })).toBeInTheDocument();
  });

  it('someone else’s order is "not found" (the API 404s)', async () => {
    api(() => ({ status: 404, body: { message: 'Not Found' } }));
    renderApp(`/orders/${ORDER_ID}`);
    expect(await screen.findByRole('heading', { name: 'Order not found' })).toBeInTheDocument();
  });
});

describe('OrdersPage', () => {
  it('lists orders with status and the right next action', async () => {
    const other = '01a208e3-0000-7000-8000-000000000002';
    const expired = '01a208e3-0000-7000-8000-000000000003';
    api((c) => (c.path === '/orders' ? { body: {
      data: [order(), { ...completed(), id: other }, order({ id: expired, status: 'expired' })],
      meta: { current_page: 1, last_page: 1, total: 3 },
    } } : undefined));
    renderApp('/orders');

    expect(await screen.findByRole('heading', { name: 'My orders' })).toBeInTheDocument();
    await screen.findByText('Awaiting payment');
    expect(screen.getByRole('link', { name: 'Continue payment' })).toHaveAttribute('href', `/checkout/pay/${ORDER_ID}`);
    expect(screen.getByRole('link', { name: 'View keys' })).toHaveAttribute('href', `/orders/${other}`);
    expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute('href', `/orders/${expired}`);
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
    expect(screen.getByText('Reservation expired')).toBeInTheDocument();
  });

  it('empty history invites to the store; signed-out visitors go to login', async () => {
    api((c) => (c.path === '/orders' ? { body: { data: [], meta: { current_page: 1, last_page: 1, total: 0 } } } : undefined));
    const view = renderApp('/orders');
    expect(await screen.findByText('No orders yet. Keys you buy appear here.')).toBeInTheDocument();
    view.unmount();

    act(() => useAuthStore.getState().clear());
    const { router } = renderApp('/orders');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
