import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/safeStorage';
import type { User } from './types';

interface AuthState {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  clear: () => void;
}

/**
 * Sanctum bearer token + current user. Persisted to localStorage (PLAN.md §2 Auth: tradeoff
 * accepted, mitigated by CSP and token expiry). Server state stays in TanStack Query.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: 'auth', storage: persistStorage },
  ),
);

export const selectIsAuthenticated = (s: AuthState) => s.token !== null;
