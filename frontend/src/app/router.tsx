import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { StorePage } from '@/features/catalog/StorePage';
import { HomePage } from '@/features/home/HomePage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { CartPage } from '@/features/cart/CartPage';
import { UiShowcasePage } from '@/pages/dev/UiShowcasePage';
import { NotFoundPage, PlaceholderPage } from '@/pages/PlaceholderPage';

export const routes = [
  {
    element: <AppLayout footer="full" />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'store', element: <StorePage /> },
      { path: 'product/:slug', element: <PlaceholderPage title="Product" milestone="M5" /> },
      { path: 'orders', element: <RequireAuth><PlaceholderPage title="My orders" milestone="M7" /></RequireAuth> },
      { path: 'dev/ui', element: <UiShowcasePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AppLayout header="checkout" footer="checkout" />,
    children: [
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <RequireAuth><PlaceholderPage title="Checkout" milestone="M7" /></RequireAuth> },
    ],
  },
  {
    element: <AppLayout header="minimal" footer="auth" />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
