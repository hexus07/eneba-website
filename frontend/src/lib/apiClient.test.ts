import { useAuthStore } from '@/features/auth/authStore';
import { API_BASE, ApiError, apiClient } from './apiClient';

const user = { id: 1, name: 'Ada', email: 'ada@example.com', created_at: '2026-11-23T00:00:00Z' };

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

const headersOf = (fn: ReturnType<typeof mockFetch>) => (fn.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.getState().clear();
});

describe('apiClient', () => {
  it('prefixes /api/v1 on the configured origin', async () => {
    const fn = mockFetch(200, { data: [] });

    await apiClient.get('/products?q=elden');

    expect(API_BASE).toMatch(/\/api\/v1$/);
    expect(fn.mock.calls[0]?.[0]).toBe(`${API_BASE}/products?q=elden`);
    expect(headersOf(fn).Accept).toBe('application/json');
  });

  it('sends the bearer token from the auth store when signed in', async () => {
    useAuthStore.getState().setSession('1|secret', user);
    const fn = mockFetch(200, { data: user });

    await apiClient.get('/auth/me');

    expect(headersOf(fn).Authorization).toBe('Bearer 1|secret');
  });

  it('sends no Authorization header when signed out', async () => {
    const fn = mockFetch(200, {});
    await apiClient.get('/home');
    expect(headersOf(fn).Authorization).toBeUndefined();
  });

  it('JSON-encodes bodies', async () => {
    const fn = mockFetch(201, { data: {} });

    await apiClient.post('/cart/items', { offer_id: 3, quantity: 2 });

    const init = fn.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"offer_id":3,"quantity":2}');
    expect(headersOf(fn)['Content-Type']).toBe('application/json');
  });

  it('throws ApiError with Laravel validation errors', async () => {
    mockFetch(422, { message: 'The email has already been taken.', errors: { email: ['The email has already been taken.'] } });

    const error = await apiClient.post('/auth/register', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).fieldError('email')).toBe('The email has already been taken.');
  });

  it('clears the session when an authenticated request gets 401 (expired/revoked token)', async () => {
    useAuthStore.getState().setSession('1|expired', user);
    mockFetch(401, { message: 'Unauthenticated.' });

    await expect(apiClient.get('/orders')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch(204, null);
    await expect(apiClient.post('/auth/logout')).resolves.toBeUndefined();
  });

  it('handles non-JSON error bodies', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' })));
    await expect(apiClient.get('/home')).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' });
  });
});
