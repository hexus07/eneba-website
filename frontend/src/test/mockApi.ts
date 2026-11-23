import { API_BASE } from '@/lib/apiClient';

type Handler = (url: URL) => { status?: number; body: unknown } | 'pending' | undefined;

/**
 * Stub fetch for the API. `handler` gets the parsed URL (path relative to /api/v1 in url.pathname
 * via `apiPath`) and returns a status/body, 'pending' for a request that never settles, or undefined
 * for a 404. Returns the list of requested URLs.
 */
export function mockApi(handler: Handler) {
  const requests: URL[] = [];
  vi.stubGlobal('fetch', vi.fn<typeof fetch>((input) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    requests.push(url);
    const result = handler(url);
    if (result === 'pending') return new Promise<Response>(() => undefined); // never settles: "still loading"
    const res = result ?? { status: 404, body: { message: 'Not Found' } };
    return Promise.resolve(new Response(JSON.stringify(res.body), { status: res.status ?? 200, headers: { 'Content-Type': 'application/json' } }));
  }));
  return requests;
}

/** JSON body of the n-th fetch call (for POST/PATCH assertions). */
export function requestBody(n = 0): unknown {
  const body = vi.mocked(fetch).mock.calls[n]?.[1]?.body;
  return typeof body === 'string' ? JSON.parse(body) : undefined;
}

/** "/products" for http://localhost:8000/api/v1/products?… */
export const apiPath = (url: URL) => url.pathname.replace(new URL(API_BASE).pathname, '');
