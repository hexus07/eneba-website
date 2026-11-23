import { useState, type SubmitEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { Button, TextInput } from '@/components/ui';
import { safeRedirect, useAuthenticate } from './api';
import { AuthShell } from './AuthShell';
import { selectIsAuthenticated, useAuthStore } from './authStore';
import { formText, toFormErrors } from './formErrors';

export function LoginPage() {
  const [params] = useSearchParams();
  const redirectTo = safeRedirect(params.get('redirect'));
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const authenticate = useAuthenticate();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof toFormErrors>>({ fields: {} });

  if (isAuthenticated && !busy) return <Navigate to={redirectTo} replace />;

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({ fields: {} });
    try {
      await authenticate('login', { email: formText(form, 'email'), password: formText(form, 'password') }, redirectTo);
    } catch (error) {
      setErrors(toFormErrors(error));
      setBusy(false);
    }
  };

  const registerHref = `/register${params.get('redirect') ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`;

  return (
    <AuthShell title="Log in" subtitle={<>New user? <Link to={registerHref} className="text-accent hover:underline">Create account</Link></>}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-15">
        {errors.form && <p role="alert" className="bg-surface-card p-12 text-body-sm text-fg-region">{errors.form}</p>}
        <TextInput label="Email" name="email" type="email" autoComplete="email" required size="lg" error={errors.fields.email} />
        <TextInput label="Password" name="password" type="password" autoComplete="current-password" required size="lg" error={errors.fields.password} />
        <Button type="submit" size="lg" fullWidth loading={busy} className="mt-10">Log in</Button>
      </form>
    </AuthShell>
  );
}
