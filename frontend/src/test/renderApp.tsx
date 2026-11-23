import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';

/** Render the real app routes at a URL. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { router, ...render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>) };
}
