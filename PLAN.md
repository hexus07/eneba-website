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
| Homepage | Standard+ | Backend-driven layout, per-block endpoints (✅ backend), per-block error isolation (frontend) |
| Product page | Standard | Details, offers from multiple sellers sorted by price, seller rating, platform/region badges (✅ backend, incl. variants) |
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
- `GET /home/blocks/{key}` returns that block's payload (implemented). `BlockRegistry` maps the block `type` to a provider class through `config/home.php`. A new block type is one class implementing `Services\Home\BlockProvider` plus one config line. Blocks whose type has no provider are left out of the layout and return 404, so a row added ahead of a deploy can't break the page.
  - `hero_banner` → `HeroBannerBlockProvider`: `banners` table, respects `starts_at`/`ends_at`. Banners are our own copy on a `theme` gradient (`violet` | `gold` | `teal`, CHECK constraint) built from tokens in the frontend; `image_url` is optional and unused by the seed (no Eneba or publisher artwork)
  - `best_sellers` → `BestSellersBlockProvider`: units from *completed* orders in the last `days` (default 30), topped up by `products.sales_count` when there aren't enough recent sales
  - `deals` → `DealsBlockProvider`: active offers with the biggest discount vs `original_price_cents`, one per product, `min_discount_percent` threshold
  - `new_releases` → `NewReleasesBlockProvider`: released (not future) games by `release_date`
  - `by_platform` → `ByPlatformBlockProvider`: in-stock products of the platform in the block's `config.platform`, most popular first (seeded: "Top on Steam", "PlayStation picks")
  - `platform_tiles` → `PlatformTilesBlockProvider`: `platforms` with in-stock product counts and a `/store?platform=` link
  - Product blocks only include in-stock products (`offers_count > 0`). Per-block `config` sets `limit`, etc. Seeded by `HomeSeeder` (5 blocks, 3 banners pointing at real products).
  - Product blocks show **one card per title** (`OnePerTitle`: over-fetch 5×, keep the best-ranked variant), since every platform/region variant is a product. They also return `see_all_url`, so "See all" links are backend-driven too.
  - Best sellers ranks by units in completed orders over the last `days`, topped up by `sales_count` (identical to "by sales_count" until real orders exist).
  - Frontend: `HomePage` → `blockRegistry.ts` (type → `{ Component, Skeleton }`) → `BlockSlot` (own `Suspense` + `ErrorBoundary` + `QueryErrorResetBoundary`, `useSuspenseQuery` per block). A failing block shows "couldn't load" + Try again in place; an empty block renders nothing.
  - Not done: response caching per block.
- The frontend has a `type → component` map. It fetches each block on its own with its own skeleton and error boundary, so a failing block disappears without breaking the page. No content, titles or ordering are hardcoded in the frontend.
- Each block is an independent contract (its own endpoint and data source), so a block can later move to a separate service without frontend changes.

### Search
- Postgres extension `pg_trgm` only. Normalization happens in PHP (`SearchNormalizer`), not with Postgres `unaccent`, so the stored column and the incoming query go through exactly the same function.
- `products.search_title`: lowercased, accents stripped, punctuation and hyphens removed ("Spider-Man: Miles Morales" → "spiderman miles morales"). It is kept in sync in the model `saving` hook.
- Index: one GIN `gin_trgm_ops` index on `search_title` with `fastupdate = off`. It serves both the ILIKE substring match and the `<%` word-similarity operator (the planner combines them with a BitmapOr). `fastupdate` is off because bulk inserts otherwise sit in GIN's pending list and the planner falls back to a seq scan.
- Query strategy in `ProductSearch` (implemented). A product matches if either:
  1. `search_title ILIKE '%q%'` (prefix / partial names; the only path for queries under 3 chars)
  2. `q <% search_title` (pg_trgm word similarity ≥ `config('search.word_similarity_threshold')`, default 0.5). The threshold is set per request with `set_config(..., true)` inside a transaction, so it is safe behind Neon's transaction pooler.
- Relevance order: title starts with q → some word starts with q → `word_similarity + similarity` → `sales_count`. (`word_similarity` alone tied "eldn" at 0.600 for Elden Ring and The Elder Scrolls, and popularity picked Skyrim; whole-string `similarity` separates them, 0.231 vs 0.071.)
- A query of only symbols (`%`, `!!!`) matches nothing rather than everything.
- No `tsvector` full-text search. Titles are short names, not prose, so stemming and stop-words add little, and trigram + ILIKE already covers whole words, partials and typos. Revisit only if we search descriptions.
- "Did you mean" (implemented): on a zero-result search, `meta.did_you_mean` is the title with the best `similarity() + word_similarity()` among products matching the other filters (so following it finds results), minimum score 0.3. `word_similarity` alone ranks badly: "eldn rng" ties Elden Ring with "The Elder Scrolls" (0.33) and the more popular one wins; the sum separates them (0.67 vs 0.40).
- Known limit: a typo in *every* short word ("eldn rng", word_similarity 0.33) falls below the 0.5 threshold. One typo per phrase works ("eldn ring" 0.62, "elden rng" 0.70).
- `GET /search/suggest?q=` serves the header autocomplete (implemented: top 8 in-stock products, at least 2 characters, same matching, ranking and threshold as the catalog via `ProductFilter::suggest`). The debounce and keyboard navigation are frontend work.

### Store / catalog
- `GET /products` accepts filters for platform[], region[], genre[], type[] (repeated or CSV; OR within a dimension, AND across), price_min/max, plus `sort` (relevance | popular | price_asc | price_desc | newest) and pagination. `in_stock` is not implemented.
- Facets (implemented): `meta.facets.{platform,region,genre}` = `[{slug, name, count, selected}]` for the current query, disjunctive (each dimension counts against the other filters only). Selected options stay listed at 0. `meta.price_range` = min/max of the results ignoring the price filter. No type facet (type comes from the nav links).
- Price filtering and sorting use the denormalized `products.min_price_cents`, which an `Offer` observer recomputes along with `offers_count`.
- On the frontend, filter state lives in the URL query string as the single source of truth. That makes results shareable and keeps back/forward working.

### Checkout & keys (implemented, M7: reservation model)
1. **Cart**: server-side for signed-in users, guest cart in localStorage (priced via `POST /cart/preview`, merged on login).
2. **`POST /checkout`** (optional `Idempotency-Key`): first runs the expiry sweep inline, then in one transaction creates a `pending` order (prices snapshotted from offers) and **reserves** its keys with `SELECT … FOR UPDATE SKIP LOCKED` + a status-guarded UPDATE (`KeyReservations::reserve`). Any shortage rolls everything back → 409 with current stock, no order. `expires_at = now + 15 min`.
3. **Payment**: fake `POST /checkout/{order}/confirm {outcome}` (409 if the reservation expired) or the signed, idempotent Stripe webhook. Success sells exactly that order's reserved keys; decline/cancel releases them at once.
4. **Expiry**: `orders:expire-reservations` (scheduled every minute) marks unpaid orders `expired` and releases their keys; checkout runs the same sweep inline for hosts without a scheduler. A Stripe payment arriving after expiry is refunded (claimed as `refunding` before the provider call).
5. **Orders**: `GET /orders`, `GET /orders/{id}` with plaintext keys for the owner's completed orders only (others get 404), `no-store`.

### Auth
- Sanctum personal access tokens sent as `Authorization: Bearer`. The frontend and API are on different domains, so tokens avoid cross-site cookie and CSRF problems.
- The token is stored in localStorage. Tradeoff: it is exposed if an XSS bug exists. Mitigations are a strict CSP on Vercel, no `dangerouslySetInnerHTML`, and a configured token expiry.
- Rate limiting: `throttle:auth` (5/min) on login/register. *Not yet:* a general `throttle:api` limit elsewhere.

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
  status ENUM(available, reserved, sold),   -- reserved at checkout until the order's expires_at
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

**Covers:** Steam's portrait capsule `library_600x900.jpg` (4:5 cards). Checked 2026-11-23: 80 of 82 seeded apps have one; the 2 DLCs (2138330, 2778580) don't, and the frontend falls back to their landscape `header.jpg` (`lib/covers.ts`), then a text placeholder. Hero banners use `header.jpg`.

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
| GET | `/me` | ✓ | alias of `/auth/me` |

### Catalog & search
| Method | Path | Notes |
|---|---|---|
| GET | `/products` | **Implemented:** `q, platform, region, genre, type` (repeated or CSV), `price_min, price_max` (cents, inclusive), `sort=relevance\|popular\|price_asc\|price_desc\|newest, page, per_page(≤48)` → `{data, links, meta}`; meta adds `facets`, `price_range`, `did_you_mean`. Not implemented: `in_stock` |
| GET | `/products/{slug}` | **Implemented:** product + genres + purchasable offers (active and in stock, cheapest first) with seller rating, reviews, verified flag, stock and `discount_percent`, plus `variants` (same title on other platforms/regions). 404 for unknown slug |
| GET | `/filters` | *Not needed:* facets on `/products` already list every option with counts, so the store needs no separate call. |
| GET | `/search/suggest` | **Implemented:** `q` (at least 2 chars) → top 8 **titles** (relevance order), each its cheapest in-stock variant: `{ slug, title, cover_url, min_price_cents, currency, platform, variants_count }` |

### Home
| Method | Path | Notes |
|---|---|---|
| GET | `/home` | **Implemented:** ordered layout `[{ key, type, title, endpoint }]` |
| GET | `/home/blocks/{key}` | **Implemented:** `{ key, type, title, items: [...] }`. Item shape depends on `type`. 404 if inactive, unknown or unregistered type |

### Cart (auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/cart` | items with live prices + stock, totals |
| POST | `/cart/items` | `{ offer_id, quantity? }`: adds to the existing line. 422 if inactive, over stock or over 10 |
| PATCH | `/cart/items/{id}` | `{ quantity }` |
| DELETE | `/cart/items/{id}` | |
| POST | `/cart/merge` | `{ items: [{ offer_id, quantity }] }` (guest cart on login) |
| POST | `/cart/preview` | – | **public**, 60/min: `{ items: [{ offer_id, quantity }] }` → same `{ data: { items, totals } }` as `GET /cart`, priced live, nothing stored (guest cart page) |

### Checkout, payments, orders (auth unless noted)
| Method | Path | Notes |
|---|---|---|
| POST | `/checkout` | optional header `Idempotency-Key`. → 201 `{ data: order, payment: {provider, client_secret, publishable_key} \| {provider, confirm_url} }` (200 on replay). 409 out of stock / unavailable, 422 empty cart, 502 provider down |
| POST | `/payments/stripe/webhook` | **no auth**, Stripe signature verified. Handles `payment_intent.succeeded / payment_failed / canceled` |
| GET | `/checkout/{order}/payment` | `{ data: Order, payment: PaymentInfo \| null }`: resume paying (same Stripe PaymentIntent); `null` once not payable |
| POST | `/checkout/{order}/confirm` | `{ outcome: succeed \| fail }`. 404 unless `PAYMENT_DRIVER=fake` |
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
    │       ├── Home/BlockRegistry.php, BlockProvider.php, Blocks/*BlockProvider.php
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
  - font: **Metropolis** (confirmed on eneba.com in DevTools), self-hosted via `@fontsource/metropolis` (latin, 400–800, `font-display: swap`); fallback `Inter, system-ui, sans-serif`. License: public domain (Unlicense), not OFL (checked against the upstream repo); text shipped at `frontend/public/licenses/metropolis-UNLICENSE.txt`
  - product card: cover image, platform + region chips, title (2-line clamp), "From" price, discount %
- Layouts to match: header (logo, centered search, cart, account), store grid with left filter sidebar (drawer on mobile), product page with offers column, dark footer.
- Recreate the look; do **not** copy Eneba's logo, illustrations or copyrighted imagery. Use a text wordmark.

---

## 7. Deployment

Step-by-step dashboard instructions: **`DEPLOY.md`**.

| Piece | Where | Notes |
|---|---|---|
| Frontend | Vercel | root dir `frontend/` (build reads `../design/tokens.json`), `VITE_API_URL` at build time; `frontend/vercel.json`: SPA rewrite, immutable `/assets` caching, strict CSP (no `unsafe-inline`; `connect-src` `*.onrender.com`, `img-src` Steam CDN) |
| Backend | Render web service (Docker, free, Frankfurt) | `render.yaml` Blueprint; `backend/Dockerfile` = composer stage + `serversideup/php:8.4-fpm-nginx` (:8080); `docker/entrypoint.d/60-release.sh` at container start: config/route/event cache → `migrate --force --database=pgsql_direct` → optional `db:seed` (`SEED_DEMO_DATA`, idempotent). Health check `/up`. `trustProxies('*')` so rate limits see client IPs |
| DB | Neon (eu-central-1) | `DB_URL` = **pooled** (PgBouncer transaction mode, `DB_EMULATE_PREPARES=true`); `DB_DIRECT_URL` = direct, used by the `pgsql_direct` connection for migrations/seeding |
| Payments | `PAYMENT_DRIVER=fake` or `stripe` (test mode) | Stripe test mode works on the backend (`STRIPE_*`, webhook `https://<render>/api/v1/payments/stripe/webhook`) and the payment page renders the Stripe Payment Element (`StripePayment.tsx`); `GET /checkout/{order}/payment` returns the same PaymentIntent after a reload. CSP allows js.stripe.com / api.stripe.com / hooks.stripe.com |

CORS (`config/cors.php`): `CORS_ALLOWED_ORIGINS` (exact, comma-separated; default localhost:5173/4173) + optional `CORS_ALLOWED_ORIGIN_PATTERNS` (regex, Vercel previews). Paths `api/*`, no credentials (bearer tokens), headers Accept/Authorization/Content-Type/Idempotency-Key. No scheduler on Render free: reservation expiry also runs inline at checkout.

Verified locally: image against Postgres 16 behind PgBouncer (transaction mode): migrate via direct, seed, full purchase via pooler, restart idempotent; production build served with the vercel.json headers → no CSP violations.

---|---|---|
| Frontend | Vercel | `frontend/` root, `VITE_API_URL`, SPA rewrite in `vercel.json`, CSP header |
| Backend | Render Web Service (Docker) | `serversideup/php:8.3-fpm-nginx` base; `php artisan migrate --force` on deploy; health check `/up` |
| DB | Neon | use **pooled** connection string; PgBouncer transaction mode → `PDO::ATTR_EMULATE_PREPARES => true`; direct (unpooled) URL for migrations |
| Payments | Stripe test mode | `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`; webhook → `https://<render>/api/v1/payments/stripe/webhook` |

CORS (*not configured yet*: Laravel's default currently allows any origin): allow only the Vercel origin(s) and `localhost:5173`. Known limitation: on Render's free tier the first request after idle takes about 50s (cold start). The frontend shows a "waking up server" state when a request runs long.

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
| When keys are taken | Reserved at checkout (`SKIP LOCKED`), 15-min expiry (scheduled + inline sweep), sold on payment | Assign on payment success | Nobody pays for a key that is gone. Cost: abandoned checkouts hold stock for up to 15 min; late payments are refunded |
| Keys in history | Returned in order responses (`no-store`) | Masked + reveal endpoint | Simpler UX and API. Cost: keys travel on every history load. `revealed_at` is kept for a future reveal flow |
| Filter state | URL query string | Client store | Shareable links, back button works |

---

## 9. Milestones

1. **M0 Scaffolding:** 🟡 backend + frontend scaffolds and `apiClient` done. Missing: docker-compose, CI. Planned: monorepo, docker-compose Postgres, Laravel API skeleton + Sanctum, Vite/Tailwind app, apiClient, CI lint/test.
2. **M1 Data:** ✅ migrations, models, factories, realistic seeders, Offer observer.
3. **M2 Design system:** ✅ `frontend/` scaffold, tokens → Tailwind theme (palette and spacing replaced, enforced by lint and tests), `components/ui` (Button ×4, Badge ×4, PriceTag, ProductCard with hover add-to-cart, SectionHeading, TextInput, Checkbox, QuantityStepper, Spinner, Skeleton), AppLayout with Header and Footer Full/Checkout/Auth, `/dev/ui` showcase, `apiClient`, `money`. Font: Metropolis. Brand: "gamekeys" (confirmed). Planned: sample eneba.com, finalize tokens, build `components/ui`, AppLayout (header/footer).
4. **M3 Store + Search (deep):** ✅ Backend: typo-tolerant search, platform/region/genre/type/price filters, disjunctive facets, price range, did-you-mean, slim suggest. Frontend: `/store` with URL-only state, facet sidebar (drawer on mobile), price range, chips, sort, pagination, skeleton/error/empty states, "Did you mean"; header autocomplete (debounced, ARIA combobox, keyboard). Gaps: no add-to-cart on store cards (the card resource has no offer id, the product page will have it), no `in_stock` filter, and the facet/price queries run on every page change (no caching).
5. **M4 Homepage:** ✅ Backend: 6 block types (hero_banner, best_sellers, deals, new_releases, by_platform, platform_tiles), gradient/text banners, one card per title, seeded layout of 7 blocks. Frontend: registry-driven HomePage, per-block skeleton/error isolation with retry, ScrollRow carousels, deals add to the guest cart. Gaps: no per-block caching; deals add to the *guest* cart even when signed in (server cart wiring is M6 frontend); no category-shortcut icons (Eneba's icon row needs artwork).
6. **M5 Product page:** ✅ `/product/:slug` (product.png): breadcrumbs, cover, title + platform/region, facts, version switcher, featured cheapest offer with Add to cart, seller offer rows (rating, verified, price, discount, "Lowest price", low stock), description + details + genre links, "Gamers also viewed" (same first genre via the catalog API); loading / error / 404 / out-of-stock states. Gaps: no "Best cashback" badge (there is no cashback data), no media gallery or reviews, no wishlist.
7. **M6 Auth + Cart:** ✅ Backend (earlier) + `GET /me` alias + public `POST /cart/preview` (guest cart priced live, same shape as `GET /cart`). Frontend: login/register (login.png/register.png; email + password only), guest-cart merge on login (kept on failure), `?redirect=` with open-redirect guard, `RequireAuth` on /checkout and /orders, logout revoking the token; cart page (checkout.png) for guests and users with stock/region warnings; header count, toasts. Gaps: no password reset or email verification; no social / magic-link login; the 7-day token simply expires (no refresh).
8. **M7 Checkout:** ✅ Reservation model (backend), checkout → payment (countdown) → keys (reveal + copy), order history. Stripe test mode: Payment Element on the payment page (`PAYMENT_DRIVER=stripe`). Gap: not yet run end to end against the real Stripe test API (needs the account's test keys + webhook).
9. **M8 Polish & deploy:** 🟡 deploy config done (Docker/Render/Neon/Vercel/CORS, DEPLOY.md); polish items open. responsive pass, skeletons, empty states, a11y basics, Vercel/Render/Neon deploy, README with scope justification.

## 10. Open issues

- **Intermittent slow `OfferStats` recompute (root cause unknown).** The original `UPDATE products … FROM (products ⋈ offers GROUP BY)` form sometimes ran for more than 60s, and once for 18 minutes at 100% CPU, during `CatalogSeeder`'s `refreshAll()` in the test suite (about 2 in 13 full runs, only in seeder tests, only late in a series of runs).
  - Ruled out: stale or "empty" planner stats, stats taken while committed test rows existed, and a forced worst-case nested-loop plan. Every probe finished in about 0.01s.
  - Mitigation: rewrote the statement as per-product correlated subqueries (two index lookups per row, no self-join), so work is bounded whatever the plan. The local `eneba_test` DB has `statement_timeout = 60s`, so a recurrence fails fast instead of hanging.
  - Status (2026-11-23): after the rewrite, 0 failures in 20 consecutive full-suite runs (vs 2 in 13 before). Strong evidence (about 4% chance of that by luck at the old rate) but no root cause, so keep the timeout guard and reopen if it recurs, especially after bulk imports in production.


## 11. Open questions / later
- Variant switching: the backend already returns `variants` by exact title match. A `group_slug` is only needed if titles diverge between variants.
- Price history / "lowest in 30 days" badge: nice-to-have, not planned.
