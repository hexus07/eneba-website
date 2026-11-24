import { Link } from 'react-router';
import { buttonClasses, SectionHeading } from '@/components/ui';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col items-start gap-20 px-15 py-50 xl:px-0">
      <SectionHeading as="h1">Page not found</SectionHeading>
      <Link to="/" className={buttonClasses('primary')}>Back to the store</Link>
    </section>
  );
}
