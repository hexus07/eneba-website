import { Outlet } from 'react-router';
import { Footer, type FooterVariant } from './Footer';
import { Header } from './Header';

/** Page chrome. Routes pick the footer: full (store pages), checkout (cart/checkout), auth (login/register). */
export function AppLayout({ footer = 'full' }: { footer?: FooterVariant }) {
  return (
    <div className={footer === 'auth' ? 'flex min-h-screen flex-col bg-surface-footer' : 'flex min-h-screen flex-col'}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-15 focus:top-15 focus:z-50 focus:bg-accent focus:px-15 focus:py-10 focus:text-fg-on-accent">
        Skip to content
      </a>
      <Header />
      <main id="content" className="flex-1">
        <Outlet />
      </main>
      <Footer variant={footer} />
    </div>
  );
}
