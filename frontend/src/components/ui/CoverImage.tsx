import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { coverCandidates } from '@/lib/covers';

export interface CoverImageProps {
  url: string | null | undefined;
  /** Shown when there is no URL or every candidate failed. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * Product cover with the fallback chain from lib/covers.ts: portrait capsule → landscape header →
 * `fallback`. Render with `key={url}` if the URL can change, so the chain restarts.
 */
export function CoverImage({ url, fallback = null, className }: CoverImageProps) {
  const candidates = coverCandidates(url);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];

  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setAttempt((a) => a + 1)}
      className={cn('size-full object-cover', className)}
    />
  );
}
