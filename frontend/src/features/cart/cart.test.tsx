import { act, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/features/auth/authStore';
import { useToastStore } from '@/lib/toastStore';
import { apiPath, mockApi, requestBody } from '@/test/mockApi';
import { renderHookWithClient } from '@/test/renderHookWithClient';
import { mergeGuestCart, SERVER_CART_KEY, useAddToCart, useCart, useCartActions, useCartCount } from './api';
import { useGuestCartStore } from './guestCartStore';
import { EMPTY_CART, type Cart, type CartLine } from './types';

const user = { id: 1, name: 'Ada', email: 'ada@example.com', created_at: '' };

const line = (offerId: number, quantity: number, id: number | null = null): CartLine => ({
  id, offer_id: offerId, quantity, unit_price_cents: 1000, line_total_cents: 1000 * quantity, currency: 'EUR',
  available_stock: 5, is_purchasable: true,
  product: { slug: `p-${offerId}`, title: `Game ${offerId}`, cover_url: null, platform: { slug: 'steam', name: 'Steam' }, region: { slug: 'global', name: 'Global' } },
  seller: { slug: 's', name: 'Seller', rating: 4.9 },
});
const cartOf = (...lines: CartLine[]): Cart => ({
  items: lines, totals: { items_count: lines.reduce((n, l) => n + l.quantity, 0), subtotal_cents: 0, currency: 'EUR', is_purchasable: true },
});

afterEach(() => act(() => {
  useAuthStore.getState().clear();
  useGuestCartStore.getState().clear();
  useToastStore.setState({ toasts: [] });
}));

describe('useCart', () => {
  it('guest with an empty cart makes no request', async () => {
    const requests = mockApi(() => undefined);
    const { result } = renderHookWithClient(() => useCart());
    await waitFor(() => expect(result.current.data).toEqual(EMPTY_CART));
    expect(requests).toHaveLength(0);
  });

  it('guest lines are priced by POST /cart/preview', async () => {
    act(() => useGuestCartStore.getState().add(7, 2));
    mockApi((url) => (apiPath(url) === '/cart/preview' ? { body: { data: cartOf(line(7, 2)) } } : undefined));

    const { result } = renderHookWithClient(() => useCart());

    await waitFor(() => expect(result.current.data?.items[0]?.offer_id).toBe(7));
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.method).toBe('POST');
    expect(requestBody()).toEqual({ items: [{ offer_id: 7, quantity: 2 }] });
  });

  it('signed in uses GET /cart', async () => {
    act(() => useAuthStore.getState().setSession('1|t', user));
    const requests = mockApi((url) => (apiPath(url) === '/cart' ? { body: { data: cartOf(line(3, 1, 11)) } } : undefined));

    const { result } = renderHookWithClient(() => useCart());

    await waitFor(() => expect(result.current.data?.items[0]?.id).toBe(11));
    expect(requests.map(apiPath)).toEqual(['/cart']);
  });
});

describe('useCartActions', () => {
  it('guest add / update / remove change the local cart only', () => {
    const requests = mockApi(() => undefined);
    const { result } = renderHookWithClient(() => useCartActions());

    act(() => void result.current.add(5));
    act(() => void result.current.add(5, 2));
    expect(useGuestCartStore.getState().lines).toEqual([{ offerId: 5, quantity: 3 }]);
    act(() => void result.current.update(line(5, 3), 1));
    expect(useGuestCartStore.getState().lines).toEqual([{ offerId: 5, quantity: 1 }]);
    act(() => void result.current.remove(line(5, 1)));
    expect(useGuestCartStore.getState().lines).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it('signed in: mutations hit the API and replace the cached cart with the response', async () => {
    act(() => useAuthStore.getState().setSession('1|t', user));
    const requests = mockApi((url) => {
      const p = apiPath(url);
      if (p === '/cart/items') return { status: 201, body: { data: cartOf(line(5, 1, 20)) } };
      if (p === '/cart/items/20') return { body: { data: cartOf(line(5, 4, 20)) } };
      return undefined;
    });
    const { result, client } = renderHookWithClient(() => useCartActions());

    await act(() => result.current.add(5));
    expect(client.getQueryData<Cart>(SERVER_CART_KEY)?.items[0]?.quantity).toBe(1);
    await act(() => result.current.update(line(5, 1, 20), 4));
    expect(client.getQueryData<Cart>(SERVER_CART_KEY)?.items[0]?.quantity).toBe(4);
    expect(requests.map(apiPath)).toEqual(['/cart/items', '/cart/items/20']);
    expect(useGuestCartStore.getState().lines).toEqual([]);
  });
});

describe('useAddToCart', () => {
  it('toasts success, or the API validation message on failure', async () => {
    act(() => useAuthStore.getState().setSession('1|t', user));
    mockApi(() => ({ status: 422, body: { message: 'Only 2 left in stock.', errors: { quantity: ['Only 2 left in stock.'] } } }));
    const { result } = renderHookWithClient(() => useAddToCart());

    act(() => result.current(9, 'Hades'));

    await waitFor(() => expect(useToastStore.getState().toasts).toEqual([expect.objectContaining({ message: 'Only 2 left in stock.', tone: 'error' })]));
  });

  it('guest add confirms with the product title', async () => {
    const { result } = renderHookWithClient(() => useAddToCart());
    act(() => result.current(9, 'Hades'));
    await waitFor(() => expect(useToastStore.getState().toasts[0]?.message).toBe('Hades added to your cart'));
  });
});

describe('useCartCount', () => {
  it('counts the guest cart locally and the server cart when signed in', async () => {
    act(() => useGuestCartStore.getState().add(1, 3));
    const guest = renderHookWithClient(() => useCartCount());
    expect(guest.result.current).toBe(3);
    guest.unmount();

    act(() => useAuthStore.getState().setSession('1|t', user));
    mockApi((url) => (apiPath(url) === '/cart' ? { body: { data: cartOf(line(1, 5, 1)) } } : undefined));
    const signedIn = renderHookWithClient(() => useCartCount());
    await waitFor(() => expect(signedIn.result.current).toBe(5));
  });
});

describe('mergeGuestCart', () => {
  it('posts the guest lines to /cart/merge and clears them', async () => {
    act(() => useGuestCartStore.getState().add(4, 2));
    mockApi((url) => (apiPath(url) === '/cart/merge' ? { body: { data: cartOf(line(4, 2, 30)) } } : undefined));

    const merged = await mergeGuestCart();

    expect(requestBody()).toEqual({ items: [{ offer_id: 4, quantity: 2 }] });
    expect(merged?.items[0]?.id).toBe(30);
    expect(useGuestCartStore.getState().lines).toEqual([]);
  });

  it('does nothing for an empty guest cart, and keeps the lines if the merge fails', async () => {
    expect(await mergeGuestCart()).toBeNull();

    act(() => useGuestCartStore.getState().add(4, 1));
    mockApi(() => ({ status: 500, body: { message: 'boom' } }));
    await expect(mergeGuestCart()).rejects.toMatchObject({ status: 500 });
    expect(useGuestCartStore.getState().lines).toEqual([{ offerId: 4, quantity: 1 }]);
  });
});
