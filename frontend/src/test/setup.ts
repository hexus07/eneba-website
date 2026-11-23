import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Some suites run in the node environment (token pipeline, source scans): no DOM there.
if (typeof window !== 'undefined') {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });
}
