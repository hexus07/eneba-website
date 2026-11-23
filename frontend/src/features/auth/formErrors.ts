import { ApiError } from '@/lib/apiClient';

/** A text field from FormData (FormData.get can also return a File). */
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** Field errors from a Laravel 422, plus one form-level message for anything else. */
export function toFormErrors(error: unknown): { fields: Record<string, string | undefined>; form?: string } {
  if (error instanceof ApiError) {
    if (error.status === 422) return { fields: Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v[0]])) };
    if (error.status === 429) return { fields: {}, form: 'Too many attempts. Please wait a minute and try again.' };
  }
  return { fields: {}, form: 'Something went wrong. Please try again in a moment.' };
}
