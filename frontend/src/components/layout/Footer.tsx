import type { SubmitEvent } from 'react';
import { Link } from 'react-router';
import { BRAND } from '@/app/brand';
import { Button, TextInput } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LocaleSwitcher } from './LocaleSwitcher';

export type FooterVariant = 'full' | 'checkout' | 'auth';

// Payment-method strip, app-store badges, PC Mag badge and Trustpilot widget are third-party artwork
// marked "(reference — do not export)" in design/FIGMA_CLEANUP.md, so they are intentionally absent.

const YEAR = new Date().getFullYear();

const COLUMNS: { heading: string; links: { label: string; to: string }[] }[] = [
  { heading: 'About', links: [{ label: 'About us', to: '/about' }, { label: 'Contact us', to: '/contact' }, { label: 'Careers', to: '/careers' }] },
  { heading: 'Buy', links: [{ label: 'How to buy', to: '/help/how-to-buy' }, { label: 'Store', to: '/store' }, { label: 'Discounts', to: '/store?sort=price_asc' }] },
  { heading: 'Help', links: [{ label: 'FAQ', to: '/help' }, { label: 'How to activate a key', to: '/help/activation' }, { label: 'Create a ticket', to: '/help/ticket' }, { label: 'Return policy', to: '/help/returns' }] },
  { heading: 'Community', links: [{ label: 'Gaming news', to: '/news' }, { label: 'Giveaways', to: '/giveaways' }] },
  { heading: 'Business', links: [{ label: 'Sell with us', to: '/sell' }, { label: 'Advertise', to: '/advertise' }] },
];

const LEGAL = [
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Privacy notice', to: '/privacy' },
  { label: 'Cookie preferences', to: '/cookies' },
];

function Copyright({ className }: { className?: string }) {
  return (
    <p className={cn('text-body-sm text-fg-tertiary', className)}>
      Copyright © {YEAR} {BRAND.name}. {BRAND.disclaimer}
    </p>
  );
}

function FullFooter() {
  const subscribe = (e: SubmitEvent<HTMLFormElement>) => e.preventDefault(); // newsletter is out of scope (PLAN.md §1)

  return (
    <div className="mx-auto flex max-w-content flex-col gap-50 px-15 py-50 xl:px-0">
      <div className="grid grid-cols-2 gap-30 sm:grid-cols-3 lg:grid-cols-5">
        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <h2 className="mb-15 text-body font-bold text-fg-primary">{col.heading}</h2>
            <ul className="flex flex-col gap-10">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-body-sm text-fg-secondary hover:text-accent">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="flex flex-col gap-20 md:flex-row md:items-end md:justify-between">
        <form onSubmit={subscribe} className="flex w-full max-w-[400px] flex-col gap-10">
          <h2 className="text-body font-bold text-fg-primary">Get personalized game deals</h2>
          <div className="flex">
            <TextInput label="Email" hideLabel type="email" placeholder="Enter your email" className="flex-1" />
            <Button type="submit" variant="outline" className="border-l-0">Subscribe</Button>
          </div>
          <p className="text-body-sm text-fg-tertiary">You can unsubscribe at any time.</p>
        </form>
        <div className="self-start md:self-auto">
          <LocaleSwitcher variant="outlined" />
        </div>
      </div>

      <div className="flex flex-col gap-10 border-t border-line-subtle pt-20">
        <Copyright />
        <LegalLinks />
      </div>
    </div>
  );
}

function LegalLinks({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-20 gap-y-5 text-body-sm', className)}>
      {LEGAL.map((l) => (
        <li key={l.to}>
          <Link to={l.to} className="text-fg-tertiary underline hover:text-accent">{l.label}</Link>
        </li>
      ))}
    </ul>
  );
}

function CheckoutFooter() {
  return (
    <div className="mx-auto flex max-w-content flex-col items-center gap-20 px-15 py-40 text-center xl:px-0">
      <h2 className="text-h2-sm text-fg-primary">Shopping on {BRAND.name} is risk-free &amp; easy!</h2>
      <p className="text-body text-fg-secondary">
        If you run into any problem, our Support Team is happy to help.{' '}
        <Link to="/help/ticket" className="text-accent hover:underline">Create a ticket</Link> and we&apos;ll get back to you as soon as possible.
      </p>
      <div className="h-px w-full bg-line-subtle" />
      <Copyright />
      <LegalLinks className="justify-center" />
    </div>
  );
}

function AuthFooter() {
  return (
    <div className="mx-auto flex max-w-content flex-wrap items-center justify-center gap-x-20 gap-y-10 px-15 py-30 text-body-sm xl:px-0">
      <LocaleSwitcher size="sm" />
      {LEGAL.map((l) => (
        <Link key={l.to} to={l.to} className="font-bold text-fg-primary hover:text-accent">{l.label}</Link>
      ))}
      <Link to="/help" className="font-bold text-fg-primary hover:text-accent">Support</Link>
      <Copyright className="w-full text-center lg:w-auto" />
    </div>
  );
}

export function Footer({ variant = 'full' }: { variant?: FooterVariant }) {
  return (
    <footer className={cn(variant === 'auth' ? 'bg-transparent' : 'bg-surface-footer')} data-variant={variant}>
      {variant === 'full' && <FullFooter />}
      {variant === 'checkout' && <CheckoutFooter />}
      {variant === 'auth' && <AuthFooter />}
    </footer>
  );
}
