import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { selectIsAuthenticated, useAuthStore } from '@/features/auth/authStore';
import { ApiError, apiClient } from '@/lib/apiClient';
import { toast } from '@/lib/toastStore';
import { selectGuestCartCount, useGuestCartStore, type GuestCartLine } from './guestCartStore';
import { EMPTY_CART, type Cart, type CartLine } from './types';

export const SERVER_CART_KEY = ['cart', 'server'] as const;

const toApiLines = (lines: GuestCartLine[]) => lines.map((l) => ({ offer_id: l.offerId, quantity: l.quantity }));
const getServerCart = (signal?: AbortSignal) => apiClient.get<{ data: Cart }>('/cart', signal ? { signal } : {}).then((r) => r.data);

/**
 * The cart in one shape for everyone: signed in → GET /cart; guest → the localStorage lines priced
 * by POST /cart/preview (live prices and stock). The guest key includes the lines, so any guest
 * change re-prices automatically.
 */
export function useCart() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const lines = useGuestCartStore((s) => s.lines);
  return useQuery<Cart>({
    queryKey: isAuthenticated ? SERVER_CART_KEY : ['cart', 'guest', lines],
    queryFn: ({ signal }) =>
      isAuthenticated
        ? getServerCart(signal)
        : lines.length === 0
          ? Promise.resolve(EMPTY_CART)
          : apiClient.post<{ data: Cart }>('/cart/preview', { items: toApiLines(lines) }, { signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

/** Header badge: server count when signed in, local count for guests (no request per page). */
export function useCartCount(): number {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const guestCount = useGuestCartStore(selectGuestCartCount);
  const { data } = useQuery({ queryKey: SERVER_CART_KEY, queryFn: ({ signal }) => getServerCart(signal), enabled: isAuthenticated });
  return isAuthenticated ? (data?.totals.items_count ?? 0) : guestCount;
}

/** First validation message of a cart error, or a generic one. */
export function cartErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.fieldError('quantity') ?? error.fieldError('offer_id') ?? error.message;
  }
  return 'Something went wrong. Please try again.';
}

/** Cart mutations; server responses (the whole re-priced cart) replace the cached cart. */
export function useCartActions() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const queryClient = useQueryClient();
  const guest = useGuestCartStore();
  const setServerCart = useCallback((cart: Cart) => queryClient.setQueryData(SERVER_CART_KEY, cart), [queryClient]);

  const add = useCallback(async (offerId: number, quantity = 1) => {
    if (!isAuthenticated) {
      guest.add(offerId, quantity);
      return;
    }
    setServerCart((await apiClient.post<{ data: Cart }>('/cart/items', { offer_id: offerId, quantity })).data);
  }, [isAuthenticated, guest, setServerCart]);

  const update = useCallback(async (line: CartLine, quantity: number) => {
    if (!isAuthenticated || line.id === null) {
      guest.setQuantity(line.offer_id, quantity);
      return;
    }
    setServerCart((await apiClient.patch<{ data: Cart }>(`/cart/items/${line.id}`, { quantity })).data);
  }, [isAuthenticated, guest, setServerCart]);

  const remove = useCallback(async (line: CartLine) => {
    if (!isAuthenticated || line.id === null) {
      guest.remove(line.offer_id);
      return;
    }
    setServerCart((await apiClient.delete<{ data: Cart }>(`/cart/items/${line.id}`)).data);
  }, [isAuthenticated, guest, setServerCart]);

  return { add, update, remove };
}

/** "Add to cart" button handler with feedback toasts. */
export function useAddToCart() {
  const { add } = useCartActions();
  return useCallback((offerId: number, title?: string) => {
    add(offerId).then(
      () => toast(title ? `${title} added to your cart` : 'Added to your cart'),
      (error: unknown) => toast(cartErrorMessage(error), 'error'),
    );
  }, [add]);
}

/**
 * After login/register: move the guest cart into the server cart (POST /cart/merge clamps to stock
 * and drops unavailable lines), then clear it locally. On failure the guest lines are kept.
 */
export async function mergeGuestCart(): Promise<Cart | null> {
  const lines = useGuestCartStore.getState().lines;
  if (lines.length === 0) return null;
  const cart = (await apiClient.post<{ data: Cart }>('/cart/merge', { items: toApiLines(lines) })).data;
  useGuestCartStore.getState().clear();
  return cart;
}
