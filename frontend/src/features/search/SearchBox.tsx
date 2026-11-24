import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { CoverImage, SearchIcon, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { MIN_SUGGEST_LENGTH, useSuggestions, type Suggestion } from './api';

export const SUGGEST_DEBOUNCE_MS = 200;

/** "Elden Ring, Steam, €29.49" or, for several variants, "Elden Ring, 4 versions, from €22.74". */
function suggestionLabel(s: Suggestion): string {
  const price = s.min_price_cents === null ? 'out of stock' : formatMoney(s.min_price_cents, s.currency);
  return s.variants_count > 1 ? `${s.title}, ${s.variants_count} versions, from ${price}` : `${s.title}, ${s.platform.name}, ${price}`;
}

export interface SearchBoxProps {
  /** Distinguishes the desktop and mobile instances' ids. */
  idSuffix: string;
  initialValue?: string;
}

/**
 * Header search with autocomplete (WAI-ARIA combobox + listbox). Suggestions come from
 * GET /search/suggest, debounced. ↑/↓ move the highlight, Enter opens the highlighted product or
 * (nothing highlighted / "See all") the store search, Esc or leaving the box closes the list.
 */
export function SearchBox({ idSuffix, initialValue = '' }: SearchBoxProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ids = { input: `search-${idSuffix}`, list: `search-${idSuffix}-list`, option: (i: number) => `search-${idSuffix}-opt-${i}` };
  const statusId = useId();

  const query = value.trim();
  const debounced = useDebouncedValue(query, SUGGEST_DEBOUNCE_MS);
  const { data: suggestions = [], isFetching, isError, isSuccess } = useSuggestions(debounced);

  // Only show results that belong to what's typed now (not a stale debounce), plus "See all".
  const current = debounced === query && query.length >= MIN_SUGGEST_LENGTH;
  const items = current && !isError ? suggestions : [];
  const seeAllIndex = items.length; // last option
  const expanded = open && query.length >= MIN_SUGGEST_LENGTH && !isError;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const goToStore = () => {
    close();
    inputRef.current?.blur();
    void navigate(query ? `/store?q=${encodeURIComponent(query)}` : '/store');
  };

  const goToProduct = (s: Suggestion) => {
    close();
    inputRef.current?.blur();
    void navigate(`/product/${s.slug}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const count = items.length + 1; // + "See all"
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setOpen(true);
        setActive((a) => (a + 1) % count);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setOpen(true);
        setActive((a) => (a <= 0 ? count - 1 : a - 1));
        break;
      case 'Enter': {
        e.preventDefault();
        const picked = expanded && active >= 0 && active < items.length ? items[active] : undefined;
        if (picked) goToProduct(picked);
        else goToStore();
        break;
      }
      case 'Escape':
        if (expanded) {
          e.preventDefault();
          close();
        }
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative w-full"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget)) close();
      }}
    >
      <form role="search" onSubmit={(e) => { e.preventDefault(); goToStore(); }} className="flex h-control-lg w-full items-center gap-12 border border-line-default/70 px-15 focus-within:border-fg-primary">
        <label htmlFor={ids.input} className="sr-only">Search for games, top-ups and more</label>
        <SearchIcon className="size-icon-lg shrink-0 text-fg-primary" />
        <input
          ref={inputRef}
          id={ids.input}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={ids.list}
          aria-activedescendant={expanded && active >= 0 ? ids.option(active) : undefined}
          aria-describedby={statusId}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search for games, top-ups and more"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-h2-sm font-medium text-fg-primary outline-none placeholder:text-fg-tertiary [&::-webkit-search-cancel-button]:hidden"
        />
        {expanded && isFetching && <Spinner size="sm" label="Searching" />}
      </form>

      <span id={statusId} className="sr-only" aria-live="polite">
        {expanded && current && isSuccess ? `${items.length} suggestion${items.length === 1 ? '' : 's'}` : ''}
      </span>

      <ul
        id={ids.list}
        role="listbox"
        aria-label="Search suggestions"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-40 mt-4 max-h-[70vh] overflow-y-auto border border-line-subtle bg-surface-card shadow-popup"
      >
        {!current && <li role="presentation" className="px-15 py-12 text-body-sm text-fg-tertiary">Searching…</li>}
        {current && isSuccess && items.length === 0 && (
          <li role="presentation" className="px-15 py-12 text-body-sm text-fg-tertiary">No matches for “{query}”</li>
        )}
        {items.map((s, i) => (
          <li
            key={s.slug}
            id={ids.option(i)}
            role="option"
            aria-selected={active === i}
            aria-label={suggestionLabel(s)}
            onMouseDown={(e) => e.preventDefault() /* keep focus in the input */}
            onClick={() => goToProduct(s)}
            onMouseEnter={() => setActive(i)}
            className={cn('flex cursor-pointer items-center gap-12 px-15 py-8', active === i && 'bg-surface-raised')}
          >
            <span className="h-[40px] w-[32px] shrink-0 overflow-hidden bg-surface-raised">
              <CoverImage key={s.cover_url ?? ''} url={s.cover_url} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-label text-fg-primary">{s.title}</span>
              <span className="text-body-sm text-fg-muted">
                {s.variants_count > 1 ? `${s.variants_count} versions · cheapest on ${s.platform.name}` : s.platform.name}
              </span>
            </span>
            <span className="text-label text-fg-primary">
              {s.min_price_cents === null ? (
                <span className="text-fg-muted">Out of stock</span>
              ) : (
                <>{s.variants_count > 1 && <span className="text-body-sm text-fg-muted">from </span>}{formatMoney(s.min_price_cents, s.currency)}</>
              )}
            </span>
          </li>
        ))}
        <li
          id={ids.option(seeAllIndex)}
          role="option"
          aria-selected={active === seeAllIndex}
          onMouseDown={(e) => e.preventDefault()}
          onClick={goToStore}
          onMouseEnter={() => setActive(seeAllIndex)}
          className={cn('cursor-pointer border-t border-line-subtle px-15 py-12 text-label text-accent', active === seeAllIndex && 'bg-surface-raised')}
        >
          See all results for “{query}”
        </li>
      </ul>
    </div>
  );
}
