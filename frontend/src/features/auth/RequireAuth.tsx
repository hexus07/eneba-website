import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { selectIsAuthenticated, useAuthStore } from './authStore';

/** Signed-in only (checkout, orders): otherwise to /login, coming back here afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const location = useLocation();
  if (isAuthenticated) return <>{children}</>;
  const back = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?redirect=${encodeURIComponent(back)}`} replace />;
}
