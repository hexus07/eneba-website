import { Link, NavLink, useLocation } from 'react-router';
import { selectIsAuthenticated, useAuthStore } from '@/features/auth/authStore';
import { useCartCount } from '@/features/cart/api';
import { CartIcon, MenuIcon, UserIcon } from '@/components/ui';
import { SearchBox } from '@/features/search/SearchBox';
import { CheckoutStepper } from './CheckoutStepper';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Wordmark } from './Wordmark';

const NAV_LINKS = [
  { to: '/store?type=game', label: 'Games' },
  { to: '/store?sort=price_asc', label: 'Cheap Games' },
  { to: '/store?type=software', label: 'Software' },
  { to: '/store?type=gift_card', label: 'eGift Cards' },
  { to: '/store?type=subscription', label: 'Subscriptions' },
];

function CartLink() {
  const count = useCartCount();
  return (
    <Link to="/cart" className="relative inline-flex text-fg-primary hover:text-accent" aria-label={count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}>
      <CartIcon className="size-icon-lg" />
      {count > 0 && (
        <span aria-hidden="true" className="absolute -top-8 -right-8 flex h-icon-sm min-w-icon-sm items-center justify-center rounded-full bg-danger px-4 text-badge text-fg-primary">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

function AccountLinks() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-8 text-body text-fg-primary">
        <UserIcon className="size-icon-lg" />
        <Link to="/orders" className="hidden max-w-[140px] truncate hover:text-accent sm:inline">{user?.name ?? 'My account'}</Link>
        <span aria-hidden="true" className="hidden sm:inline">|</span>
        <button type="button" onClick={clear} className="hover:text-accent">Log out</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-8 text-body text-fg-primary">
      <UserIcon className="size-icon-lg" />
      <Link to="/login" className="hover:text-accent">Log in</Link>
      <span aria-hidden="true" className="hidden sm:inline">|</span>
      <Link to="/register" className="hidden hover:text-accent sm:inline">Register</Link>
    </div>
  );
}

export type HeaderVariant = 'full' | 'checkout' | 'minimal';

/**
 * full: store pages. checkout: wordmark + progress stepper + locale (cart/checkout, as on eneba.com,
 * no distractions). minimal: wordmark only (login/register).
 */
export function Header({ variant = 'full', checkoutStep = 1 }: { variant?: HeaderVariant; checkoutStep?: 1 | 2 | 3 }) {
  if (variant === 'minimal') {
    return (
      <header className="mx-auto flex h-header w-full max-w-content items-center px-15 xl:px-0">
        <Wordmark />
      </header>
    );
  }
  if (variant === 'checkout') {
    return (
      <header className="bg-canvas-header">
        <div className="mx-auto flex h-header max-w-content items-center gap-30 px-15 xl:px-0">
          <Wordmark className="shrink-0" />
          <CheckoutStepper current={checkoutStep} />
          <div className="hidden lg:block">
            <LocaleSwitcher />
          </div>
        </div>
      </header>
    );
  }
  return <FullHeader />;
}

function FullHeader() {
  // On /store the box shows the current search, so the text and the URL never disagree. Keyed by it,
  // the box resets when the URL's q changes (Back, "did you mean", Clear) but not while typing.
  const location = useLocation();
  const storeQuery = location.pathname === '/store' ? (new URLSearchParams(location.search).get('q') ?? '') : '';

  return (
    <header>
      <div className="bg-canvas-base">
        <div className="mx-auto flex h-header max-w-content items-center gap-20 px-15 xl:px-0">
          <Wordmark className="shrink-0" />
          <div className="hidden max-w-[550px] flex-1 md:block">
            <SearchBox key={storeQuery} idSuffix="desktop" initialValue={storeQuery} />
          </div>
          <div className="hidden lg:block">
            <LocaleSwitcher />
          </div>
          <div className="ml-auto flex items-center gap-20">
            <CartLink />
            <AccountLinks />
          </div>
        </div>
        <div className="px-15 pb-15 md:hidden">
          <SearchBox key={storeQuery} idSuffix="mobile" initialValue={storeQuery} />
        </div>
      </div>
      <nav aria-label="Main" className="bg-canvas-header">
        <ul className="mx-auto flex h-nav max-w-content items-stretch gap-20 overflow-x-auto px-15 text-body whitespace-nowrap text-fg-primary xl:px-0">
          <li className="flex">
            <NavLink to="/store" className="flex items-center gap-8 hover:text-accent">
              <MenuIcon className="size-icon" />
              Categories
            </NavLink>
          </li>
          {NAV_LINKS.map((l) => (
            <li key={l.to} className="flex">
              <Link to={l.to} className="flex items-center hover:text-accent">{l.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
