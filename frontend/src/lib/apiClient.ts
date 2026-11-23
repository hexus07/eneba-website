import { useAuthStore } from '@/features/auth/authStore';

/** API origin from VITE_API_URL (see .env.example); all endpoints live under /api/v1. */
export const API_BASE = `${(import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')}/api/v1`;

/** Laravel error body: { message, errors?: { field: [messages] } } */
export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]>;
  readonly body: unknown;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}, body: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.body = body;
  }

  /** First validation message for a field, if any. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * The only HTTP entry point (CLAUDE.md). Adds JSON headers and the bearer token from the auth store;
 * throws ApiError for non-2xx. A 401 on an authenticated request means the token is dead
 * (expired / revoked), so the session is cleared.
 */
export async function request<T>(path: string, { method = 'GET', body, headers, signal }: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const init: RequestInit = {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (signal) init.signal = signal;

  const response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, init);

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token) useAuthStore.getState().clear();
    const err = (data ?? {}) as { message?: string; errors?: Record<string, string[]> };
    throw new ApiError(response.status, err.message ?? response.statusText, err.errors ?? {}, data);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...options, method: 'DELETE' }),
};
