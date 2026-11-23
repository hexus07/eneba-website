import { useState, type SubmitEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { selectIsAuthenticated, useAuthStore } from '@/features/auth/authStore';
import { selectGuestCartCount, useGuestCartStore } from '@/features/cart/guestCartStore';
import { CartIcon, MenuIcon, SearchIcon, UserIcon } from '@/components/ui';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Wordmark } from './Wordmark';

const NAV_LINKS = [
  { to: '/store?type=game', label: 'Games' },
  { to: '/store?sort=price_asc', label: 'Cheap Games' },
  { to: '/store?type=software', label: 'Software' },
  { to: '/store?type=gift_card', label: 'eGift Cards' },
  { to: '/store?type=subscription', label: 'Subscriptions' },
];

/** Layout (width, visibility) belongs to the caller's wrapper; this only draws the field. */
function SearchForm({ idSuffix }: { idSuffix: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const inputId = `site-search-${idSuffix}`;

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = q.trim();
    void navigate(query ? `/store?q=${encodeURIComponent(query)}` : '/store');
  };

  return (
    <form role="search" onSubmit={submit} className="flex h-control-lg w-full items-center gap-12 border border-line-default/70 px-15 focus-within:border-fg-primary">
      <label htmlFor={inputId} className="sr-only">Search for games, top-ups and more</label>
      <SearchIcon className="size-icon-lg shrink-0 text-fg-primary" />
      <input
        id={inputId}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for games, top-ups and more"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-h2-sm font-medium text-fg-primary outline-none placeholder:text-fg-tertiary"
      />
    </form>
  );
}

function CartLink() {
  // Signed-in cart count comes from the server cart (M6 wiring); guest cart for now.
  const count = useGuestCartStore(selectGuestCartCount);
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

export function Header() {
  return (
    <header>
      <div className="bg-canvas-base">
        <div className="mx-auto flex h-header max-w-content items-center gap-20 px-15 xl:px-0">
          <Wordmark className="shrink-0" />
          <div className="hidden max-w-[550px] flex-1 md:block">
            <SearchForm idSuffix="desktop" />
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
          <SearchForm idSuffix="mobile" />
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
