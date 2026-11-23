import { Link } from 'react-router';
import { BRAND } from '@/app/brand';
import { cn } from '@/lib/cn';

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-h2 text-fg-primary lowercase tracking-tight', className)} aria-label={`${BRAND.name} home`}>
      {BRAND.name}
    </Link>
  );
}
