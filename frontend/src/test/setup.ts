import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// No test may reach the network by accident (pages fetch on render; a dev backend may be running on
// :8000). Tests that need the API use mockApi(), which replaces this stub.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.reject(new Error(`Unmocked fetch in test: ${url}`));
  }));
});
afterEach(() => vi.unstubAllGlobals());

// Some suites run in the node environment (token pipeline, source scans): no DOM there.
if (typeof window !== 'undefined') {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });
}
