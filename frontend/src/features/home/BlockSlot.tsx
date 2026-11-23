import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui';
import type { BlockDefinition } from './blockRegistry';
import type { HomeLayoutBlock } from './types';

/**
 * Isolation for one block: its own Suspense (skeleton while ITS data loads) and its own error
 * boundary (a failing block shows a retry in place; the rest of the page is unaffected).
 */
export function BlockSlot({ block, definition }: { block: HomeLayoutBlock; definition: BlockDefinition }) {
  const { Component, Skeleton } = definition;
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallback={(retry) => (
            <section aria-label={block.title} role="alert" className="flex flex-wrap items-center justify-between gap-15 bg-surface-card p-20">
              <p className="text-body text-fg-secondary">
                <strong className="text-fg-primary">{block.title}</strong> couldn’t load.
              </p>
              <Button variant="outline" size="sm" onClick={retry}>Try again</Button>
            </section>
          )}
        >
          <Suspense fallback={<Skeleton block={block} />}>
            <Component block={block} />
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
