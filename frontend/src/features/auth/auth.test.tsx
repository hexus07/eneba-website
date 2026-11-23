import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGuestCartStore } from '@/features/cart/guestCartStore';
import { useToastStore } from '@/lib/toastStore';
import { apiPath, mockApi } from '@/test/mockApi';
import { renderApp } from '@/test/renderApp';
import { safeRedirect } from './api';
import { useAuthStore } from './authStore';

const ada = { id: 1, name: 'Ada', email: 'ada@example.com', created_at: '' };
const emptyCart = { items: [], totals: { items_count: 0, subtotal_cents: 0, currency: 'EUR', is_purchasable: false } };

/** Requests made to the API, with JSON bodies. */
function api(handler: (path: string, body: unknown) => { status?: number; body: unknown } | undefined) {
  const calls: { path: string; body: unknown }[] = [];
  mockApi((url) => {
    const path = apiPath(url);
    const init = vi.mocked(fetch).mock.calls.at(-1)?.[1];
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ path, body });
    return handler(path, body) ?? (path.startsWith('/cart') ? { body: { data: emptyCart } } : undefined);
  });
  return calls;
}

async function fillLogin(email = 'ada@example.com', password = 'secret123') {
  await userEvent.type(await screen.findByLabelText(/^email/i), email);
  await userEvent.type(screen.getByLabelText(/^password/i), password);
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

afterEach(() => act(() => {
  useAuthStore.getState().clear();
  useGuestCartStore.getState().clear();
  useToastStore.setState({ toasts: [] });
}));

describe('safeRedirect', () => {
  it.each([
    ['/checkout', '/checkout'],
    ['/store?q=x', '/store?q=x'],
    [null, '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});

describe('LoginPage', () => {
  it('logs in, merges the guest cart into the account and returns to ?redirect', async () => {
    act(() => useGuestCartStore.getState().add(42, 2));
    const calls = api((path) => (path === '/auth/login' ? { body: { data: ada, token: '1|tok' } } : undefined));
    const { router } = renderApp('/login?redirect=%2Forders');

    await fillLogin();

    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'));
    expect(calls.find((c) => c.path === '/auth/login')?.body).toEqual({ email: 'ada@example.com', password: 'secret123' });
    expect(calls.find((c) => c.path === '/cart/merge')?.body).toEqual({ items: [{ offer_id: 42, quantity: 2 }] });
    expect(useAuthStore.getState()).toMatchObject({ token: '1|tok', user: ada });
    expect(useGuestCartStore.getState().lines).toEqual([]);
  });

  it('shows the credentials error on the email field', async () => {
    api(() => ({ status: 422, body: { message: 'These credentials do not match our records.', errors: { email: ['These credentials do not match our records.'] } } }));
    renderApp('/login');

    await fillLogin('ada@example.com', 'wrong');

    const email = await screen.findByLabelText(/^email/i);
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription('These credentials do not match our records.');
    expect(useAuthStore.getState().token).toBeNull();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  it('explains rate limiting and server errors above the form', async () => {
    api(() => ({ status: 429, body: { message: 'Too Many Attempts.' } }));
    renderApp('/login');
    await fillLogin();
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Please wait a minute');
  });

  it('ignores an off-site ?redirect', async () => {
    api((path) => (path === '/auth/login' ? { body: { data: ada, token: '1|tok' } } : undefined));
    const { router } = renderApp('/login?redirect=%2F%2Fevil.example');
    await fillLogin();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('sends a signed-in visitor straight on', async () => {
    act(() => useAuthStore.getState().setSession('1|t', ada));
    api(() => undefined);
    const { router } = renderApp('/login?redirect=%2Fcart');
    await waitFor(() => expect(router.state.location.pathname).toBe('/cart'));
  });

  it('still logs in when merging the guest cart fails, keeping the items and saying so', async () => {
    act(() => useGuestCartStore.getState().add(42));
    api((path) => (path === '/auth/login' ? { body: { data: ada, token: '1|tok' } } : path === '/cart/merge' ? { status: 500, body: { message: 'boom' } } : undefined));
    renderApp('/login');

    await fillLogin();

    await waitFor(() => expect(useAuthStore.getState().token).toBe('1|tok'));
    expect(useGuestCartStore.getState().lines).toEqual([{ offerId: 42, quantity: 1 }]);
    expect(useToastStore.getState().toasts[0]?.tone).toBe('error');
  });

  it('links to registration, keeping the redirect', async () => {
    api(() => undefined);
    renderApp('/login?redirect=%2Fcheckout');
    expect(await screen.findByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register?redirect=%2Fcheckout');
  });
});

describe('RegisterPage', () => {
  async function fillRegister() {
    await userEvent.type(await screen.findByLabelText(/^name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/^email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    await userEvent.type(screen.getByLabelText(/^confirm password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('creates the account and signs in', async () => {
    const calls = api((path) => (path === '/auth/register' ? { status: 201, body: { data: ada, token: '2|new' } } : undefined));
    const { router } = renderApp('/register');

    await fillRegister();

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(calls.find((c) => c.path === '/auth/register')?.body).toEqual({ name: 'Ada', email: 'ada@example.com', password: 'secret123', password_confirmation: 'secret123' });
    expect(useAuthStore.getState().token).toBe('2|new');
  });

  it('shows each validation error on its field', async () => {
    api(() => ({ status: 422, body: { message: 'Invalid', errors: { email: ['The email has already been taken.'], password: ['The password field must contain at least one number.'] } } }));
    renderApp('/register');

    await fillRegister();

    await waitFor(() => expect(screen.getByLabelText(/^email/i)).toHaveAccessibleDescription('The email has already been taken.'));
    expect(screen.getByLabelText(/^password/i)).toHaveAccessibleDescription('The password field must contain at least one number.');
    expect(screen.getByLabelText(/^name/i)).not.toHaveAttribute('aria-invalid');
  });
});

describe('RequireAuth and logout', () => {
  it('sends signed-out visitors to login and back after signing in', async () => {
    api((path) => (path === '/auth/login' ? { body: { data: ada, token: '1|tok' } } : undefined));
    const { router } = renderApp('/orders');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?redirect=%2Forders');
    await fillLogin();
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'));
    expect(screen.getByRole('heading', { name: 'My orders' })).toBeInTheDocument();
  });

  it('log out revokes the token server-side, then clears the session (even if the API fails)', async () => {
    act(() => useAuthStore.getState().setSession('1|t', ada));
    const calls = api((path) => (path === '/auth/logout' ? { status: 500, body: { message: 'down' } } : undefined));
    const { router } = renderApp('/store?q=x');

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
    expect(calls.some((c) => c.path === '/auth/logout')).toBe(true);
    expect(router.state.location.pathname).toBe('/');
  });
});
