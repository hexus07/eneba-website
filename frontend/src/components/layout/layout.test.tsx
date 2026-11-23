import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { useAuthStore } from '@/features/auth/authStore';
import { useGuestCartStore } from '@/features/cart/guestCartStore';
import { renderApp } from '@/test/renderApp';

afterEach(() => {
  act(() => {
    useAuthStore.getState().clear();
    useGuestCartStore.getState().clear();
  });
});

describe('Header', () => {
  it('shows the text wordmark, search, locale, cart and auth links', () => {
    renderApp('/');
    expect(screen.getByRole('link', { name: /gamekeys home/i })).toHaveAttribute('href', '/');
    expect(screen.getAllByRole('search').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Language: English EU, currency: EUR').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Cart, empty' })).toHaveAttribute('href', '/cart');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  });

  it('shows the guest cart count', () => {
    act(() => {
      useGuestCartStore.getState().add(1, 2);
      useGuestCartStore.getState().add(2);
    });
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Cart, 3 items' })).toBeInTheDocument();
  });

  it('search submits to the store with the query', async () => {
    const { router } = renderApp('/');
    const [input] = screen.getAllByRole('combobox', { name: 'Search for games, top-ups and more' });
    if (!input) throw new Error('no search box');

    await userEvent.type(input, 'elden ring{Enter}');

    expect(router.state.location.pathname).toBe('/store');
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('elden ring');
  });

  it('shows the user and a working log out when signed in', async () => {
    act(() => useAuthStore.getState().setSession('1|t', { id: 1, name: 'Ada', email: 'a@example.com', created_at: '' }));
    renderApp('/');

    expect(screen.getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/orders');
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(useAuthStore.getState().token).toBeNull();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('AppLayout footer variants by route', () => {
  it.each([
    ['/', 'full'],
    ['/store', 'full'],
    ['/cart', 'checkout'],
    ['/checkout', 'checkout'],
    ['/login', 'auth'],
    ['/register', 'auth'],
  ])('%s uses the %s footer', (path, variant) => {
    const { container } = renderApp(path);
    expect(container.querySelector('footer')).toHaveAttribute('data-variant', variant);
  });

  it('full footer has the newsletter and link columns; checkout footer has support; auth footer is one row', () => {
    const full = renderApp('/');
    expect(screen.getByText('Get personalized game deals')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Help' })).toBeInTheDocument();
    full.unmount();

    const checkout = renderApp('/cart');
    expect(screen.getByRole('link', { name: 'Create a ticket' })).toBeInTheDocument();
    checkout.unmount();

    renderApp('/login');
    expect(screen.getByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(screen.queryByText('Get personalized game deals')).not.toBeInTheDocument();
  });

  it('never renders third-party payment / app-store artwork', () => {
    const { container } = renderApp('/');
    expect(container.querySelectorAll('footer img')).toHaveLength(0);
  });

  it('checkout pages use the stepper header; auth pages a wordmark-only header', () => {
    const checkout = renderApp('/cart');
    expect(screen.getByRole('list', { name: 'Checkout progress' })).toBeInTheDocument();
    expect(screen.getByText('Cart').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    checkout.unmount();

    renderApp('/login');
    expect(screen.getByRole('link', { name: /gamekeys home/i })).toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
  });

  it('has a skip link to the main content', () => {
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#content');
    expect(document.getElementById('content')?.tagName).toBe('MAIN');
  });

  it('unknown routes render the not-found page inside the layout', () => {
    renderApp('/definitely-not-a-page');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('/dev/ui', () => {
  it('renders every component section', () => {
    renderApp('/dev/ui');
    for (const name of ['Button', 'Badge', 'PriceTag', 'ProductCard', 'SectionHeading', 'TextInput', 'Checkbox', 'QuantityStepper', 'Spinner', 'Skeleton', 'Select', 'Chip', 'Pagination', 'Drawer', 'LocaleSwitcher', 'Footer']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  it('card add-to-cart updates the header cart count', async () => {
    renderApp('/dev/ui');
    await userEvent.click(screen.getByRole('button', { name: /add to cart: cyberpunk 2077$/i }));
    expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeInTheDocument();
  });
});
