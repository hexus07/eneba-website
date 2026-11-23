import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { mergeGuestCart, SERVER_CART_KEY } from '@/features/cart/api';
import { apiClient } from '@/lib/apiClient';
import { toast } from '@/lib/toastStore';
import { useAuthStore } from './authStore';
import type { User } from './types';

interface AuthResponse {
  data: User;
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
  password_confirmation: string;
}

/**
 * Where to go after login: only same-site paths ("/checkout"), never "//evil.example" or a full
 * URL, so ?redirect= can't be used as an open redirect.
 */
export function safeRedirect(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/';
}

/** Login/register: store the session, move the guest cart into the account, then redirect. */
export function useAuthenticate() {
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(async (kind: 'login' | 'register', input: LoginInput | RegisterInput, redirectTo: string) => {
    const { data: user, token } = await apiClient.post<AuthResponse>(kind === 'login' ? '/auth/login' : '/auth/register', input);
    setSession(token, user);
    try {
      const merged = await mergeGuestCart();
      if (merged) queryClient.setQueryData(SERVER_CART_KEY, merged);
    } catch {
      toast('We couldn’t move your cart into your account. Your items are still saved on this device.', 'error');
    }
    void navigate(redirectTo, { replace: true });
  }, [setSession, queryClient, navigate]);
}

/** Revoke the token server-side (best effort), then forget the session and the cached cart. */
export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      /* token may already be expired/revoked: logging out locally is what matters */
    }
    clear();
    queryClient.removeQueries({ queryKey: ['cart'] });
    void navigate('/');
  }, [clear, queryClient, navigate]);
}
