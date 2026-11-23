# Eneba-style Marketplace — Plan

A digital-key marketplace in Eneba's style: store with filters, typo-tolerant search, a homepage built from backend blocks, product pages with multi-seller offers, cart → checkout → key delivery, and accounts.

**Stack:** React + TypeScript + Vite + Tailwind · Laravel 13 (REST) · PostgreSQL
**Deploy:** Vercel (frontend) · Render (backend, Docker) · Neon (Postgres)

---

## 1. Scope and depth

The brief says "a few features done extensively beat many minimal ones". The depth decisions:

| Area | Depth | Notes |
|---|---|---|
| **Search & Store** | **Deep** | Typo/partial tolerant search, header autocomplete, facet counts, URL-synced filters, sorting, pagination, empty/zero-result states with suggestions |
| **Eneba visual fidelity** | **Deep** | Design tokens, close match on components, responsive down to 360px, skeletons, hover/focus states, mobile nav + filter drawer |
| Homepage | Standard+ | Backend-driven layout, per-block endpoints, per-block error isolation |
| Product page | Standard | Details, offers from multiple sellers sorted by price, seller rating, platform/region badges |
| Checkout & keys | Standard+ | ✅ Cart, Stripe PaymentIntents (test) + fake gateway, keys assigned on payment success with `SKIP LOCKED`, auto-refund on oversell, idempotent webhook, order history with keys. Tested under real multi-process concurrency |
| Auth | Standard | ✅ Register/login/logout/me, Sanctum bearer tokens (7-day expiry), rate-limited login, protected routes |

**Out of scope (deliberately):** seller dashboards / listing creation, reviews authoring, wishlists, multi-currency, i18n, email delivery (keys are shown in-app), admin UI (content managed through seeders / DB).

---

## 2. Architecture

```
┌──────────────────────┐      HTTPS / JSON       ┌───────────────────────────────┐      ┌──────────────┐
│  Vercel              │  ───────────────────▶   │  Render (Docker)              │ ───▶ │  Neon        │
│  React SPA           │   /api/v1/*             │  Laravel 13 API               │      │  Postgres    │
│  TanStack Query      │   Authorization: Bearer │  ├─ Catalog + Search          │      │  pg_trgm     │
│  React Router        │                         │  ├─ Home (layout + providers) │      │              │
│  Zustand (guest cart,│                         │  ├─ Cart / Checkout / Orders  │      └──────────────┘
│   auth token)        │                         │  └─ Payments (Stripe | Fake)  │ ◀─── Stripe webhook
└──────────────────────┘                         └───────────────────────────────┘
```

### Backend: modular monolith
- API only, versioned under `/api/v1`. No Blade views.
- Controllers stay thin: validate (FormRequest), call a service, return an API Resource.
- Domain logic lives in `app/Services/*`: `Search\ProductSearch`, `Home\BlockRegistry` + one provider per block, `Checkout\CheckoutService`, `Checkout\KeyAllocator`, `Payments\PaymentGateway` (interface) with `StripeGateway` and `FakeGateway`.
- The frontend only sees API Resources. It never sees raw Eloquent models.

### Homepage: backend-driven blocks
- `home_blocks` table holds the layout: `key`, `type`, `title`, `position`, `config jsonb`, `is_active`.
- `GET /home` returns the ordered layout: `[{ key, type, title, endpoint }]`.
- `GET /home/blocks/{key}` returns that block's payload. `BlockRegistry` maps the block `type` to a provider class:
  - `hero_banner` → `BannerBlockProvider` (reads `banners` table, respects `starts_at`/`ends_at`)
  - `best_sellers` → `BestSellersBlockProvider` (aggregates `order_items` over N days, falls back to `products.sales_count`)
  - `deals` → `DealsBlockProvider` (offers with the highest discount vs `original_price_cents`)
  - `new_releases` → `NewReleasesBlockProvider` (by `release_date`)
  - `platform_tiles` → `PlatformTilesBlockProvider` (from `platforms`)
- The frontend has a `type → component` map. It fetches each block on its own with its own skeleton and error boundary, so a failing block disappears without breaking the page. No content, titles or ordering are hardcoded in the frontend.
- Each block is an independent contract (its own endpoint and data source), so a block can later move to a separate service without frontend changes.

### Search
- Postgres extension `pg_trgm` only. Normalization happens in PHP (`SearchNormalizer`), not with Postgres `unaccent`, so the stored column and the incoming query go through exactly the same function.
- `products.search_title`: lowercased, accents stripped, punctuation and hyphens removed ("Spider-Man: Miles Morales" → "spiderman miles morales"). It is kept in sync in the model `saving` hook.
- Index: one GIN `gin_trgm_ops` index on `search_title` with `fastupdate = off`. It serves both the ILIKE substring match and the `<%` word-similarity operator (the planner combines them with a BitmapOr). `fastupdate` is off because bulk inserts otherwise sit in GIN's pending list and the planner falls back to a seq scan.
- Query strategy in `ProductSearch` (implemented). A product matches if either:
  1. `search_title ILIKE '%q%'` (prefix / partial names; the only path for queries under 3 chars)
  2. `q <% search_title` (pg_trgm word similarity ≥ `config('search.word_similarity_threshold')`, default 0.5). The threshold is set per request with `set_config(..., true)` inside a transaction, so it is safe behind Neon's transaction pooler.
- Relevance order: title starts with q → some word starts with q → `word_similarity` → `sales_count`.
- A query of only symbols (`%`, `!!!`) matches nothing rather than everything.
- No `tsvector` full-text search. Titles are short names, not prose, so stemming and stop-words add little, and trigram + ILIKE already covers whole words, partials and typos. Revisit only if we search descriptions.
- When a search returns zero results, return a "did you mean" suggestion: the title with the highest `similarity`.
- `GET /search/suggest?q=` serves the header autocomplete (top 8, debounced 200ms, keyboard navigable). The catalog's `q` uses the same service, so the dropdown and the full results always agree.

### Store / catalog
- `GET /products` accepts filters for platform[], region[], genre[], type, price_min/max and in_stock, plus `sort` (relevance | popular | price_asc | price_desc | newest) and pagination.
- The response includes **facets**: counts per platform/region/genre/type under the current filters, so each facet's count excludes its own filter. The price range (min/max) is included too.
- Price filtering and sorting use the denormalized `products.min_price_cents`, which an `Offer` observer recomputes along with `offers_count`.
- On the frontend, filter state lives in the URL query string as the single source of truth. That makes results shareable and keeps back/forward working.

### Checkout & keys (implemented)
1. **Cart**: server-side for signed-in users (`cart_items`). Guests keep a localStorage cart, merged with `POST /cart/merge` on login (best effort: unavailable lines dropped, quantities clamped to stock). Prices are live. Adding checks stock and caps each line at 10 keys.
2. **`POST /checkout`** (optional `Idempotency-Key` header, replays return the same order and payment):
   - re-prices from current offers (client totals ignored) and checks stock. Any shortfall or inactive offer returns **409** `{items:[{offer_id, reason, requested, available}]}` and creates no order.
   - creates a `pending` order with item snapshots (title, platform, region, seller, unit price). **No keys are touched yet.**
   - asks the gateway for a payment and returns `{data: order, payment}`.
3. **Payment**:
   - **Stripe**: a PaymentIntent created with Stripe idempotency key `order-{id}`. The SPA confirms it with Elements using `client_secret`. The signed webhook `payment_intent.succeeded` fulfills the order, but only if `amount_received` and currency match the order. `payment_failed` keeps the order pending (Elements can retry), and `canceled` fails it.
   - **Fake**: `POST /payments/fake/{order}/confirm {outcome: succeed|fail}`.
   - Both go through `OrderFulfiller`.
4. **Key assignment on success** (`OrderFulfiller::markPaid`), in one transaction:
   - lock the order row. If it isn't `pending`, stop (duplicate webhooks and double confirms are no-ops).
   - for each item, `SELECT … FOR UPDATE SKIP LOCKED LIMIT qty` on available keys, then `UPDATE … WHERE status='available'` with an affected-row check.
   - mark the order `completed` and remove the purchased lines from the cart.
   - *after commit*, deactivate offers that sold out, through Eloquent so product stats update. (Inside the transaction, concurrent buyers of the last keys can't see each other's sales.)
5. **Oversell** (stock ran out between checkout and payment): the whole assignment rolls back, all or nothing. The order is claimed `pending → refunding` under the row lock *before* the provider call, so a retry can't fulfill an order being refunded. Then the gateway refund runs (Stripe idempotency key `refund-{id}`) and the order becomes `refunded`. If the refund call fails, the webhook returns 5xx, Stripe redelivers, and the refund resumes.
6. **Order history** (`GET /orders`, `GET /orders/{id}`) returns plaintext keys for the owner's `completed` orders, with `Cache-Control: no-store`. Other users' orders return 404.
7. No reservations, so nothing expires: an abandoned `pending` order holds no stock.

### Auth
- Sanctum personal access tokens sent as `Authorization: Bearer`. The frontend and API are on different domains, so tokens avoid cross-site cookie and CSRF problems.
- The token is stored in localStorage. Tradeoff: it is exposed if an XSS bug exists. Mitigations are a strict CSP on Vercel, no `dangerouslySetInnerHTML`, and a configured token expiry.
- Rate limiting: `throttle:auth` (5/min) on login/register and `throttle:api` elsewhere.

---

## 3. Data model

```
users(id, name, email UNIQUE, password, created_at, updated_at)

platforms(id, slug UNIQUE, name, icon)                 -- steam, psn, xbox, nintendo, ea-app, ubisoft, gog, epic
regions(id, slug UNIQUE, name)                         -- global, europe, north-america, united-kingdom, ...
genres(id, slug UNIQUE, name)
genre_product(genre_id, product_id) PK(both)

products(
  id, slug UNIQUE, title, search_title,
  type ENUM(game, dlc, gift_card, subscription, software),
  platform_id FK, region_id FK,
  description, cover_url, developer, publisher, release_date,
  min_price_cents NULL, offers_count INT DEFAULT 0, sales_count INT DEFAULT 0,
  created_at, updated_at
)
  INDEX gin(search_title gin_trgm_ops) WITH (fastupdate = off),
        (platform_id), (region_id), (min_price_cents), (sales_count), (release_date)

sellers(id, slug UNIQUE, name, rating NUMERIC(3,2), reviews_count, is_verified, created_at)

offers(
  id, product_id FK, seller_id FK,
  price_cents INT, original_price_cents INT NULL, currency CHAR(3) DEFAULT 'EUR',
  is_active BOOL, created_at, updated_at
)
  UNIQUE(product_id, seller_id), INDEX(product_id, is_active, price_cents)

product_keys(
  id, offer_id FK (RESTRICT: sold keys outlive offers), code TEXT (encrypted cast),
  code_hash CHAR(64) UNIQUE,   -- HMAC-SHA256(APP_KEY, normalized code): ciphertext is random, so this enforces uniqueness
  status ENUM(available, reserved, sold),   -- `reserved` unused for now (keys are assigned on payment success)
  reserved_until TIMESTAMP NULL, order_item_id FK → order_items NULL, revealed_at NULL,
  created_at
)
  INDEX(offer_id, status)

cart_items(id, user_id FK, offer_id FK, quantity CHECK > 0, UNIQUE(user_id, offer_id))   -- one cart per user: no carts table

orders(
  id UUID, user_id FK, status CHECK IN (pending, completed, failed, refunding, refunded),
  total_cents, currency, payment_provider, payment_ref UNIQUE NULL, idempotency_key NULL,
  failure_reason NULL, paid_at NULL, fulfilled_at NULL, created_at, updated_at
)
  UNIQUE(user_id, idempotency_key), INDEX(user_id, created_at)
order_items(
  id, order_id FK, offer_id FK, product_id FK,
  product_title, platform_name, region_name, seller_name, unit_price_cents, quantity      -- snapshot
)
payment_events(id, provider, provider_event_id UNIQUE, type, payload jsonb, processed_at)   -- audit + dedupe fast path

banners(id, title, subtitle, image_url, cta_label, cta_url, position, starts_at NULL, ends_at NULL, is_active)
home_blocks(id, key UNIQUE, type, title, position, config jsonb, is_active)
personal_access_tokens  -- Sanctum
```

**Key modelling decision:** one `product` is one sellable variant (title × platform × region), the way Eneba lists "Elden Ring (PC) Steam Key GLOBAL". This keeps filtering simple. Product pages link to sibling variants (same title, other platform/region) through a `group_slug` column, added only if time allows.

**Offer stats:** `products.min_price_cents` and `offers_count` are the cheapest price and number of **active** offers. `OfferObserver` keeps them in sync on Eloquent create/update/delete (`Services/Catalog/OfferStats`). It always recomputes from `offers`, after taking a `FOR NO KEY UPDATE` lock on the product so concurrent writers can't store stale values. Mass query-builder updates skip observers, so run `php artisan catalog:sync-offer-stats` after them. Sold-out handling: fulfillment deactivates an offer once its last key is sold, and the observer then updates the product.

**Money:** always integer cents plus a currency. Single currency (EUR) for now.

**Seed data** (`CatalogSeeder`, data in `database/seeders/data/catalog.php`; deterministic RNG seed): 91 titles (83 games, 2 DLC, 6 gift cards/subscriptions) → 323 platform × region products, 8 platforms, 5 regions, 17 genres, 12 fictional sellers, 1,277 offers (2–6 per product, about 8% inactive, about 50% with a "was" price), and 14,823 fake keys (`XXXXX-XXXXX-XXXXX`). Sales counts decay with popularity. Demo user: `demo@example.com` / `password`. Covers come from public Steam CDN header images and fall back to placeholders. No Eneba-owned assets (logo, artwork) are used.

---

## 4. REST API (`/api/v1`)

Response conventions: `{ data, meta? }`. Errors follow `{ message, errors? }` (Laravel default) with correct status codes (401, 403, 404, 409, 422, 429).

### Auth
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | – | `{name, email, password, password_confirmation}` → 201 `{ data: user, token }`. Password ≥ 8 chars with letters and numbers. Throttled 5/min |
| POST | `/auth/login` | – | `{email, password}` → `{ data: user, token }`. Same 422 for unknown email and wrong password. Throttled 5/min per email+IP |
| POST | `/auth/logout` | ✓ | revokes current token |
| GET | `/auth/me` | ✓ | current user |

### Catalog & search
| Method | Path | Notes |
|---|---|---|
| GET | `/products` | **Implemented:** `q, platform[] (or csv), region[] (or csv), price_min, price_max (cents, inclusive), sort=relevance\|popular\|price_asc\|price_desc\|newest, page, per_page(≤48)` → standard Laravel pagination `{data, links, meta}`. Planned: `genre[], type, in_stock`, facets, did_you_mean |
| GET | `/products/{slug}` | product + genres + offers (active, cheapest first, with seller + stock) |
| GET | `/filters` | all platforms, regions, genres, types (for initial filter UI) |
| GET | `/search/suggest` | `q` → top 8 `{ slug, title, platform, region, cover_url, min_price_cents }` |

### Home
| Method | Path | Notes |
|---|---|---|
| GET | `/home` | ordered layout `[{ key, type, title, endpoint }]` |
| GET | `/home/blocks/{key}` | block payload; shape depends on `type` |

### Cart (auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/cart` | items with live prices + stock, totals |
| POST | `/cart/items` | `{ offer_id, quantity? }`: adds to the existing line. 422 if inactive, over stock or over 10 |
| PATCH | `/cart/items/{id}` | `{ quantity }` |
| DELETE | `/cart/items/{id}` | |
| POST | `/cart/merge` | `{ items: [{ offer_id, quantity }] }` (guest cart on login) |

### Checkout, payments, orders (auth unless noted)
| Method | Path | Notes |
|---|---|---|
| POST | `/checkout` | optional header `Idempotency-Key`. → 201 `{ data: order, payment: {provider, client_secret, publishable_key} \| {provider, confirm_url} }` (200 on replay). 409 out of stock / unavailable, 422 empty cart, 502 provider down |
| POST | `/payments/stripe/webhook` | **no auth**, Stripe signature verified. Handles `payment_intent.succeeded / payment_failed / canceled` |
| POST | `/payments/fake/{order}/confirm` | `{ outcome: succeed \| fail }`. 404 unless `PAYMENT_DRIVER=fake` |
| GET | `/orders` | paginated history (10/page), newest first, **plaintext keys** for completed orders, `no-store` |
| GET | `/orders/{id}` | same shape for one order. Another user's order returns 404 |

---

## 5. Folder structure

```
eneba-website/
├── PLAN.md  CLAUDE.md  README.md
├── docker-compose.yml               # local Postgres 16 (+ pg_trgm)
├── frontend/
│   ├── index.html  vite.config.ts  tailwind.config.ts  vercel.json
│   └── src/
│       ├── main.tsx
│       ├── app/                     # router, providers, AppLayout (header, footer), ProtectedRoute
│       ├── features/
│       │   ├── home/                # HomePage, blocks/{HeroBanner,ProductCarousel,PlatformTiles}, blockRegistry.ts
│       │   ├── catalog/             # StorePage, FilterSidebar, FilterDrawer, SortSelect, useCatalogQuery
│       │   ├── search/              # SearchBar (autocomplete), useSuggest
│       │   ├── product/             # ProductPage, OfferList, OfferRow
│       │   ├── cart/                # CartPage, cartStore (guest), useCart
│       │   ├── checkout/            # CheckoutPage, FakePaymentPage, CheckoutResult
│       │   ├── auth/                # LoginPage, RegisterPage, authStore, useAuth
│       │   └── orders/              # OrdersPage, OrderDetailPage, KeyReveal
│       │       (each feature: api.ts, hooks, components/, *Page.tsx, types.ts)
│       ├── components/ui/           # Button, Input, Badge, PriceTag, ProductCard, Rating, Skeleton, Pagination, Checkbox, Drawer
│       ├── lib/                     # apiClient (fetch wrapper), money.ts, queryClient.ts, url-state.ts
│       └── styles/                  # index.css (Tailwind layers, font-face)
└── backend/
    ├── Dockerfile  render.yaml
    ├── app/
    │   ├── Http/
    │   │   ├── Controllers/Api/V1/  # AuthController, ProductController, SearchController, HomeController, CartController, CheckoutController, PaymentController, OrderController
    │   │   ├── Requests/            # ProductIndexRequest, CheckoutRequest, ...
    │   │   └── Resources/           # ProductResource, ProductCardResource, OfferResource, OrderResource, ...
    │   ├── Models/
    │   ├── Observers/               # OfferObserver (min_price/offers_count)
    │   └── Services/
    │       ├── Search/ProductSearch.php, SearchNormalizer.php
    │       ├── Catalog/ProductFilter.php, FacetBuilder.php
    │       ├── Home/BlockRegistry.php, Blocks/*BlockProvider.php, Contracts/BlockProvider.php
    │       ├── Checkout/CheckoutService.php, KeyAllocator.php, OrderFulfiller.php
    │       └── Payments/PaymentGateway.php, StripeGateway.php, FakeGateway.php
    ├── config/search.php, payments.php
    ├── database/{migrations, factories, seeders}
    ├── routes/api.php
    └── tests/{Feature, Unit}
```

---

## 6. Eneba styling

- Approach: build a token layer in `tailwind.config.ts` (colors, font, radii, shadows, spacing) and `components/ui/*` on top of it. No ad-hoc hex values in features.
- Provisional tokens to **verify by sampling eneba.com** in milestone M2:
  - background: deep violet/indigo gradient (`bg-900 ≈ #1a0b3d`, `bg-800 ≈ #2a1162`), card surface slightly lighter
  - accent / CTA: yellow (`≈ #ffd200`) on dark text; secondary accent purple (`≈ #7c3aed`)
  - discount badge: green/lime; text: white / white-70%
  - font: confirm on site (geometric sans); fallback `Inter`
  - product card: cover image, platform + region chips, title (2-line clamp), "From" price, discount %
- Layouts to match: header (logo, centered search, cart, account), store grid with left filter sidebar (drawer on mobile), product page with offers column, dark footer.
- Recreate the look; do **not** copy Eneba's logo, illustrations or copyrighted imagery. Use a text wordmark.

---

## 7. Deployment

| Piece | Where | Notes |
|---|---|---|
| Frontend | Vercel | `frontend/` root, `VITE_API_URL`, SPA rewrite in `vercel.json`, CSP header |
| Backend | Render Web Service (Docker) | `serversideup/php:8.3-fpm-nginx` base; `php artisan migrate --force` on deploy; health check `/up` |
| DB | Neon | use **pooled** connection string; PgBouncer transaction mode → `PDO::ATTR_EMULATE_PREPARES => true`; direct (unpooled) URL for migrations |
| Payments | Stripe test mode | `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`; webhook → `https://<render>/api/v1/payments/stripe/webhook` |

CORS: allow only the Vercel origin(s) and `localhost:5173`. Known limitation: on Render's free tier the first request after idle takes about 50s (cold start). The frontend shows a "waking up server" state when a request runs long.

---

## 8. Tradeoffs (summary)

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Home block sources | Modular monolith, one provider + endpoint per block | Separate deployable services | Same per-block contract without extra deploys and cold starts. Blocks can be split out later |
| Search engine | Postgres pg_trgm (trigram + ILIKE) | Meilisearch / Algolia | No extra infra, good typo handling at this scale. Cost: weaker relevance tuning, no synonyms |
| Price filter/sort | Denormalized `min_price_cents` | Join/aggregate per query | Fast and indexable. Cost: must stay in sync (observer) |
| Product granularity | Variant = title × platform × region | Product + variants tables | Matches Eneba listings, simple filters. Cost: duplicated descriptions |
| Auth transport | Bearer tokens | Sanctum cookies via Vercel proxy | Simple cross-domain setup. Cost: token in localStorage (XSS exposure) |
| Payments | Stripe test + Fake gateway behind one interface | Fake only | Real webhook/idempotency flow. Fake keeps local dev and tests offline |
| Background jobs | Sync fulfillment in the webhook request | Queue worker | Render free tier has no worker. Fine at demo scale |
| When keys are taken | Assigned on payment success (`SKIP LOCKED`), auto-refund on oversell | Reserve at checkout with expiry | No reservation expiry or cleanup job, and abandoned checkouts hold no stock. Cost: in a race for the last keys, a buyer can pay and then be refunded instead of being told "sold out" before paying (checkout's stock check makes this rare) |
| Keys in history | Returned in order responses (`no-store`) | Masked + reveal endpoint | Simpler UX and API. Cost: keys travel on every history load. `revealed_at` is kept for a future reveal flow |
| Filter state | URL query string | Client store | Shareable links, back button works |

---

## 9. Milestones

1. **M0 Scaffolding:** monorepo, docker-compose Postgres, Laravel API skeleton + Sanctum, Vite/Tailwind app, apiClient, CI lint/test.
2. **M1 Data:** ✅ migrations, models, factories, realistic seeders, Offer observer.
3. **M2 Design system:** ✅ `frontend/` scaffold, tokens → Tailwind theme (palette and spacing replaced, enforced by lint and tests), `components/ui` (Button ×4, Badge ×4, PriceTag, ProductCard with hover add-to-cart, SectionHeading, TextInput, Checkbox, QuantityStepper, Spinner, Skeleton), AppLayout with Header and Footer Full/Checkout/Auth, `/dev/ui` showcase, `apiClient`, `money`. Open: font family and brand name to confirm (§10). Planned: sample eneba.com, finalize tokens, build `components/ui`, AppLayout (header/footer).
4. **M3 Store + Search (deep):** `ProductSearch`, `ProductFilter`, `FacetBuilder` + tests. StorePage with URL-synced filters, drawer, pagination, autocomplete, did-you-mean.
5. **M4 Homepage:** home_blocks, providers, `/home` endpoints. Block registry with isolated loading and error states.
6. **M5 Product page:** details and offers list, add to cart.
7. **M6 Auth + Cart:** ✅ register/login, protected routes, guest cart and merge.
8. **M7 Checkout:** ✅ CheckoutService, OrderFulfiller, Fake + Stripe gateway, webhook, orders with keys.
9. **M8 Polish & deploy:** responsive pass, skeletons, empty states, a11y basics, Vercel/Render/Neon deploy, README with scope justification.

## 10. Open questions / later
- **Seeded covers are landscape.** `CatalogSeeder` stores Steam's `header.jpg` (460×215), but product cards are portrait 4:5 like Eneba's, so covers are heavily cropped. Steam's `library_600x900.jpg` (portrait) fits and is what `/dev/ui` uses. Switch the seeder (backend change, not done in M2).
- **Font family unconfirmed.** tokens.json says Inter (now self-hosted via `@fontsource-variable/inter`), but the screens look like a geometric sans (Metropolis-like), and FIGMA_CLEANUP.md §8 warns the import may have substituted it. One-line change in `design-tokens.ts` once checked on eneba.com.
- Variant switching on the product page (`group_slug`) if time permits.
- Price history / "lowest in 30 days" badge: nice-to-have, not planned.
