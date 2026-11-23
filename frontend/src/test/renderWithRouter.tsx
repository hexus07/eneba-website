import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

/** Render a component inside a router (for <Link>). */
export function renderWithRouter(ui: ReactElement, path = '/') {
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}
