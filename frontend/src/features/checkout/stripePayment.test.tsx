import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/features/auth/authStore';
import type { Order } from '@/features/orders/types';
import { apiPath, mockApi } from '@/test/mockApi';
import { renderApp } from '@/test/renderApp';

// Stripe.js is never loaded in tests: the Payment Element and confirmPayment are stand-ins.
const confirmPayment = vi.fn();
const loadStripe = vi.fn((key: string) => Promise.resolve({ key }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: (key: string) => loadStripe(key) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children, options }: { children: ReactNode; options: { clientSecret: string } }) => <div data-client-secret={options.clientSecret}>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({}),
}));

const ORDER_ID = '01a208e3-0000-7000-8000-000000000002';
const ada = { id: 1, name: 'Ada', email: 'ada@example.com', created_at: '' };

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID, status: 'pending', total_cents: 3000, currency: 'EUR', payment_provider: 'stripe', failure_reason: null,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), created_at: new Date().toISOString(), paid_at: null,
    items: [{ id: 1, product_slug: 'hades-steam-global', product_title: 'Hades', cover_url: null, platform_name: 'Steam', region_name: 'Global',
      seller_name: 'PixelVault', unit_price_cents: 1500, quantity: 2, line_total_cents: 3000, keys: [] }],
    ...overrides,
  };
}
const completed = () => order({ status: 'completed', paid_at: new Date().toISOString(), items: order().items.map((i) => ({ ...i, keys: [{ id: 1, code: 'ABCDE-FGHIJ-KLMNO' }] })) });
const SESSION = { provider: 'stripe', client_secret: 'pi_1_secret_x', publishable_key: 'pk_test_x' };

function api(state: { paid: boolean; payment?: unknown }) {
  const paths: string[] = [];
  mockApi((url) => {
    const path = apiPath(url);
    paths.push(path);
    if (path === `/orders/${ORDER_ID}`) return { body: { data: state.paid ? completed() : order() } };
    if (path === `/checkout/${ORDER_ID}/payment`) return { body: { data: order(), payment: state.payment === undefined ? SESSION : state.payment } };
    if (path === '/cart') return { body: { data: { items: [], totals: { items_count: 0, subtotal_cents: 0, currency: 'EUR', is_purchasable: false } } } };
    return undefined;
  });
  return paths;
}

beforeEach(() => {
  confirmPayment.mockReset();
  act(() => useAuthStore.getState().setSession('1|t', ada));
});
afterEach(() => act(() => useAuthStore.getState().clear()));

describe('Stripe payment (test mode)', () => {
  it('confirms the intent from the reloaded session, then shows the keys once the webhook completed the order', async () => {
    const state = { paid: false };
    api(state);
    confirmPayment.mockImplementation(() => {
      state.paid = true; // the webhook fulfilled the order meanwhile
      return Promise.resolve({ paymentIntent: { status: 'succeeded' } });
    });
    const { router } = renderApp(`/checkout/pay/${ORDER_ID}`);

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    expect(screen.getByTestId('payment-element').parentElement?.parentElement).toHaveAttribute('data-client-secret', 'pi_1_secret_x');
    expect(loadStripe).toHaveBeenCalledWith('pk_test_x');
    expect(screen.getByText('4242 4242 4242 4242')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Pay €30.00' }));

    expect(confirmPayment).toHaveBeenCalledWith(expect.objectContaining({
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/checkout/pay/${ORDER_ID}` },
    }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/checkout/done/${ORDER_ID}`));
  });

  it('a declined card shows Stripe’s message and lets the buyer retry', async () => {
    api({ paid: false });
    confirmPayment.mockResolvedValue({ error: { type: 'card_error', message: 'Your card was declined.' } });
    renderApp(`/checkout/pay/${ORDER_ID}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Pay €30.00' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your card was declined.');
    expect(screen.getByRole('button', { name: 'Pay €30.00' })).toBeEnabled();
  });

  it('explains a server without a publishable key instead of rendering a broken form', async () => {
    api({ paid: false, payment: { ...SESSION, publishable_key: null } });
    renderApp(`/checkout/pay/${ORDER_ID}`);

    expect(await screen.findByRole('alert')).toHaveTextContent(/missing Stripe publishable key/);
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
  });
});
