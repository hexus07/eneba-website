import { useState, type SubmitEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { BRAND } from '@/app/brand';
import { Button, TextInput } from '@/components/ui';
import { safeRedirect, useAuthenticate } from './api';
import { AuthShell } from './AuthShell';
import { selectIsAuthenticated, useAuthStore } from './authStore';
import { formText, toFormErrors } from './formErrors';

export function RegisterPage() {
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
    const field = (name: string) => formText(form, name);
    setBusy(true);
    setErrors({ fields: {} });
    try {
      await authenticate('register', {
        name: field('name'), email: field('email'), password: field('password'), password_confirmation: field('password_confirmation'),
      }, redirectTo);
    } catch (error) {
      setErrors(toFormErrors(error));
      setBusy(false);
    }
  };

  const loginHref = `/login${params.get('redirect') ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`;

  return (
    <AuthShell title="Create account" subtitle={<>Already have an account? <Link to={loginHref} className="text-accent hover:underline">Log in</Link></>}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-15">
        {errors.form && <p role="alert" className="bg-surface-card p-12 text-body-sm text-fg-region">{errors.form}</p>}
        <TextInput label="Name" name="name" autoComplete="name" required size="lg" error={errors.fields.name} />
        <TextInput label="Email" name="email" type="email" autoComplete="email" required size="lg" error={errors.fields.email} />
        <TextInput label="Password" name="password" type="password" autoComplete="new-password" required size="lg" hint="At least 8 characters, with letters and numbers." error={errors.fields.password} />
        <TextInput label="Confirm password" name="password_confirmation" type="password" autoComplete="new-password" required size="lg" error={errors.fields.password_confirmation} />
        <Button type="submit" size="lg" fullWidth loading={busy} className="mt-10">Create account</Button>
        <p className="text-body-sm text-fg-secondary">
          By creating an account you confirm you are at least 16 and agree to the {BRAND.name}{' '}
          <Link to="/terms" className="text-accent hover:underline">Terms &amp; Conditions</Link> and{' '}
          <Link to="/privacy" className="text-accent hover:underline">Privacy notice</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
