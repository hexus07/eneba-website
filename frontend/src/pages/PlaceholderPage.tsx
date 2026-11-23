import { Link } from 'react-router';
import { buttonClasses, SectionHeading } from '@/components/ui';

/** Stand-in for pages built in later milestones, so every header/footer link resolves. */
export function PlaceholderPage({ title, milestone }: { title: string; milestone: string }) {
  return (
    <section className="mx-auto flex max-w-content flex-col items-start gap-20 px-15 py-50 xl:px-0">
      <SectionHeading as="h1">{title}</SectionHeading>
      <p className="text-body text-fg-secondary">This page arrives in {milestone} (see PLAN.md §9).</p>
      <Link to="/dev/ui" className={buttonClasses('outline')}>See the UI kit</Link>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col items-start gap-20 px-15 py-50 xl:px-0">
      <SectionHeading as="h1">Page not found</SectionHeading>
      <Link to="/" className={buttonClasses('primary')}>Back to the store</Link>
    </section>
  );
}
