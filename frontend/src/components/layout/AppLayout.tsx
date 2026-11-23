import { Outlet } from 'react-router';
import { Toaster } from '@/components/ui';
import { cn } from '@/lib/cn';
import { Footer, type FooterVariant } from './Footer';
import { Header, type HeaderVariant } from './Header';

/**
 * Page chrome. Routes pick header + footer: full/full (store pages), checkout/checkout (cart,
 * checkout), minimal/auth (login, register: dark page, sampled from login.png = surface.card).
 */
export function AppLayout({ header = 'full', footer = 'full', checkoutStep = 1 }: { header?: HeaderVariant; footer?: FooterVariant; checkoutStep?: 1 | 2 | 3 }) {
  return (
    <div className={cn('flex min-h-screen flex-col', footer === 'auth' && 'bg-surface-card')}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-15 focus:top-15 focus:z-50 focus:bg-accent focus:px-15 focus:py-10 focus:text-fg-on-accent">
        Skip to content
      </a>
      <Header variant={header} checkoutStep={checkoutStep} />
      <main id="content" className="flex-1">
        <Outlet />
      </main>
      <Footer variant={footer} />
      <Toaster />
    </div>
  );
}
