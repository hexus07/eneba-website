import { useState, type ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import {
  Badge, Button, CartIcon, Checkbox, Chip, Drawer, Pagination, PriceTag, ProductCard, ProductCardSkeleton,
  QuantityStepper, SectionHeading, Select, Skeleton, SkeletonText, Spinner, TextInput,
} from '@/components/ui';
import { useAddToCart } from '@/features/cart/api';

/** /dev/ui: every component and variant on one page, for visual review against design/screens. */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-20 border-t border-line-subtle pt-30" aria-labelledby={`ui-${title}`}>
      <h2 id={`ui-${title}`} className="text-h2-sm text-fg-muted">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-10">
      <span className="text-label text-fg-tertiary">{label}</span>
      <div className="flex flex-wrap items-center gap-15">{children}</div>
    </div>
  );
}

// Seeded covers are Steam's portrait capsule (600×900), which fits the 4:5 card. If it 404s the card
// falls back to the landscape header.jpg, then a placeholder (lib/covers.ts). Plus a broken URL.
const COVER = 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg';
const BROKEN = 'https://example.invalid/missing.jpg';

export function UiShowcasePage() {
  const [qty, setQty] = useState(1);
  const [remember, setRemember] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sort, setSort] = useState('popular');
  const [chips, setChips] = useState(['Steam', 'Europe', 'RPG']);
  const add = useAddToCart();
  const addToCart = (offerId: number) => add(offerId, 'Demo product');

  return (
    <div className="mx-auto flex max-w-content flex-col gap-40 px-15 py-40 xl:px-0">
      <SectionHeading as="h1" info="Internal page: every component from FIGMA_CLEANUP.md §6">UI kit</SectionHeading>

      <Section title="Button">
        {(['primary', 'outline', 'secondary'] as const).map((variant) => (
          <Row key={variant} label={`${variant}: sm / md / lg / loading / disabled`}>
            <Button variant={variant} size="sm">Buy now</Button>
            <Button variant={variant} size="md">Buy now</Button>
            <Button variant={variant} size="lg">Buy now</Button>
            <Button variant={variant} loading>Buy now</Button>
            <Button variant={variant} disabled>Buy now</Button>
          </Row>
        ))}
        <Row label="icon: sm / md / lg">
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <Button key={size} variant="icon" size={size} aria-label="Add to cart"><CartIcon className="size-icon" /></Button>
          ))}
        </Row>
        <Row label="primary, fullWidth">
          <div className="w-full max-w-[355px]"><Button fullWidth size="lg">Proceed to checkout</Button></div>
        </Row>
      </Section>

      <Section title="Badge">
        <Row label="cashback / cashbackDeal / bestCashback / lowestPrice">
          <Badge variant="cashback" />
          <Badge variant="cashbackDeal" />
          <Badge variant="bestCashback" />
          <Badge variant="lowestPrice" />
        </Row>
      </Section>

      <Section title="PriceTag">
        <Row label="default / with label / discounted / xl / xl discounted">
          <PriceTag priceCents={2999} />
          <PriceTag label="From" priceCents={1099} />
          <PriceTag label="From" priceCents={2399} originalPriceCents={4999} />
          <PriceTag size="xl" priceCents={3816} />
          <PriceTag size="xl" priceCents={1532} originalPriceCents={3999} />
        </Row>
      </Section>

      <Section title="ProductCard">
        <p className="text-body-sm text-fg-tertiary">Hover or Tab into a card to reveal “Add to cart” (adds to the guest cart: watch the header count).</p>
        <div className="grid grid-cols-2 gap-20 sm:grid-cols-3 lg:grid-cols-5">
          <ProductCard href="/product/cyberpunk-2077-steam-global" title="Cyberpunk 2077" coverUrl={COVER} platformName="Steam" regionName="Global" isGlobal priceCents={2152} onAddToCart={() => addToCart(1)} />
          <ProductCard href="/product/cyberpunk-2077-psn-europe" title="Cyberpunk 2077 (PS5) PSN Key EUROPE with a long title that clamps" coverUrl={COVER} platformName="PSN" regionName="Europe" isGlobal={false} priceCents={1999} originalPriceCents={5999} onAddToCart={() => addToCart(2)} />
          <ProductCard href="/product/x" title="Cashback deal" coverUrl={COVER} platformName="Xbox Live" regionName="Global" isGlobal priceCents={3499} cashbackPercent={8} onAddToCart={() => addToCart(3)} />
          <ProductCard href="/product/y" title="No cover image" coverUrl={null} platformName="GOG" regionName="Global" isGlobal priceCents={999} onAddToCart={() => addToCart(4)} />
          <ProductCard href="/product/z" title="Broken image, out of stock" coverUrl={BROKEN} platformName="Epic Games" regionName="North America" isGlobal={false} priceCents={null} />
        </div>
        <Row label="ProductCardSkeleton">
          <ProductCardSkeleton className="w-card" />
        </Row>
      </Section>

      <Section title="SectionHeading">
        <SectionHeading info="Picked from what other buyers bought">Recommended for you</SectionHeading>
        <SectionHeading size="sm" info="Sorted by price" action={<Button variant="outline" size="sm">See all</Button>}>Other offers</SectionHeading>
      </Section>

      <Section title="TextInput">
        <div className="grid gap-20 md:grid-cols-2">
          <TextInput label="Email" type="email" placeholder="you@example.com" required />
          <TextInput label="Email (lg, as on login)" size="lg" placeholder="Email" />
          <TextInput label="Password" type="password" hint="At least 8 characters, letters and numbers." />
          <TextInput label="Email" defaultValue="not-an-email" error="Please enter a valid email address." />
        </div>
      </Section>

      <Section title="Checkbox">
        <Row label="checked (controlled) / unchecked / disabled">
          <Checkbox label="Remember me" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Checkbox label="I want to receive personalized offers" />
          <Checkbox label="Disabled" disabled />
        </Row>
      </Section>

      <Section title="QuantityStepper">
        <Row label={`value ${qty} (min 1, max 5) / disabled`}>
          <QuantityStepper value={qty} onChange={setQty} max={5} itemLabel="Cyberpunk 2077" />
          <QuantityStepper value={2} onChange={() => undefined} disabled />
        </Row>
      </Section>

      <Section title="Spinner">
        <Row label="sm / md / lg">
          <Spinner size="sm" /><Spinner size="md" /><Spinner size="lg" label="Processing payment" />
        </Row>
      </Section>

      <Section title="Skeleton">
        <Row label="block / text">
          <Skeleton className="h-40 w-card" />
          <SkeletonText lines={3} className="w-card" />
        </Row>
      </Section>

      <Section title="Select">
        <Row label="inline label (store sort)">
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)} options={[
            { value: 'popular', label: 'Most popular' }, { value: 'price_asc', label: 'Price: low to high' }, { value: 'newest', label: 'Newest' },
          ]} />
        </Row>
      </Section>

      <Section title="Chip">
        <Row label="active filters (click to remove)">
          {chips.map((c) => <Chip key={c} label={c} onRemove={() => setChips((all) => all.filter((x) => x !== c))} />)}
          {chips.length === 0 && <Button variant="outline" size="sm" onClick={() => setChips(['Steam', 'Europe', 'RPG'])}>Reset chips</Button>}
        </Row>
      </Section>

      <Section title="Pagination">
        <Row label="page 5 of 20 / page 1 of 3">
          <Pagination page={5} lastPage={20} hrefFor={(p) => `/dev/ui?page=${p}`} />
          <Pagination page={1} lastPage={3} hrefFor={(p) => `/dev/ui?page=${p}`} />
        </Row>
      </Section>

      <Section title="Drawer">
        <Row label="mobile filters panel">
          <Button variant="outline" onClick={() => setDrawerOpen(true)}>Open drawer</Button>
        </Row>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filters" footer={<Button fullWidth onClick={() => setDrawerOpen(false)}>Show 120 results</Button>}>
          <div className="flex flex-col gap-15 p-20">
            <Checkbox label="Steam" />
            <Checkbox label="PSN" />
          </div>
        </Drawer>
      </Section>

      <Section title="LocaleSwitcher">
        <Row label="plain (header) / outlined (footer)">
          <LocaleSwitcher />
          <LocaleSwitcher variant="outlined" />
        </Row>
      </Section>

      <Section title="Footer">
        {(['full', 'checkout', 'auth'] as const).map((variant) => (
          <div key={variant} className="flex flex-col gap-10">
            <span className="text-label text-fg-tertiary">Footer variant=&quot;{variant}&quot;</span>
            <div className={variant === 'auth' ? 'border border-line-subtle bg-surface-footer' : 'border border-line-subtle'}>
              <Footer variant={variant} />
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
