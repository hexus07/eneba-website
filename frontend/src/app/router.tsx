import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { UiShowcasePage } from '@/pages/dev/UiShowcasePage';
import { NotFoundPage, PlaceholderPage } from '@/pages/PlaceholderPage';

export const routes = [
  {
    element: <AppLayout footer="full" />,
    children: [
      { index: true, element: <PlaceholderPage title="Home" milestone="M4" /> },
      { path: 'store', element: <PlaceholderPage title="Store" milestone="M3" /> },
      { path: 'product/:slug', element: <PlaceholderPage title="Product" milestone="M5" /> },
      { path: 'orders', element: <PlaceholderPage title="My orders" milestone="M7" /> },
      { path: 'dev/ui', element: <UiShowcasePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AppLayout footer="checkout" />,
    children: [
      { path: 'cart', element: <PlaceholderPage title="My cart" milestone="M6" /> },
      { path: 'checkout', element: <PlaceholderPage title="Checkout" milestone="M7" /> },
    ],
  },
  {
    element: <AppLayout footer="auth" />,
    children: [
      { path: 'login', element: <PlaceholderPage title="Log in" milestone="M6" /> },
      { path: 'register', element: <PlaceholderPage title="Register" milestone="M6" /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
