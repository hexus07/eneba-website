import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { StorePage } from '@/features/catalog/StorePage';
import { HomePage } from '@/features/home/HomePage';
import { ProductPage } from '@/features/product/ProductPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { CartPage } from '@/features/cart/CartPage';
import { CheckoutPage } from '@/features/checkout/CheckoutPage';
import { PaymentPage } from '@/features/checkout/PaymentPage';
import { OrderDetailPage } from '@/features/orders/OrderDetailPage';
import { OrdersPage } from '@/features/orders/OrdersPage';
import { UiShowcasePage } from '@/pages/dev/UiShowcasePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const routes = [
  {
    element: <AppLayout footer="full" />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'store', element: <StorePage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'orders', element: <RequireAuth><OrdersPage /></RequireAuth> },
      { path: 'orders/:id', element: <RequireAuth><OrderDetailPage variant="history" /></RequireAuth> },
      { path: 'dev/ui', element: <UiShowcasePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // Checkout header stepper: 1 Cart → 2 Payment → 3 Get your product.
  {
    element: <AppLayout header="checkout" footer="checkout" checkoutStep={1} />,
    children: [{ path: 'cart', element: <CartPage /> }],
  },
  {
    element: <AppLayout header="checkout" footer="checkout" checkoutStep={2} />,
    children: [
      { path: 'checkout', element: <RequireAuth><CheckoutPage /></RequireAuth> },
      { path: 'checkout/pay/:id', element: <RequireAuth><PaymentPage /></RequireAuth> },
    ],
  },
  {
    element: <AppLayout header="checkout" footer="checkout" checkoutStep={3} />,
    children: [{ path: 'checkout/done/:id', element: <RequireAuth><OrderDetailPage variant="done" /></RequireAuth> }],
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
