# CLAUDE.md

Eneba-style digital-key marketplace. **Read `PLAN.md` first.** It is the source of truth for scope, data model and API. Update it when a decision changes.

## Layout
- `frontend/`: React 19 + TypeScript 6.0 (strict) + Vite 8 + Tailwind 4 (JS config via `@config`), TanStack Query, React Router 7, Zustand, ESLint (typescript-eslint strict), Vitest + Testing Library. Font: Metropolis, self-hosted via `@fontsource/metropolis` (import more weights in `src/main.tsx` only if a token needs them)
- `design/`: `tokens.json` (DTCG, the only source of design values), `FIGMA_CLEANUP.md` (naming map, reference-only artwork), `screens/` (eneba.com reference captures, **never commit or ship them**)
- `backend/`: Laravel 13, API only, PostgreSQL, Sanctum bearer tokens
- `docker-compose.yml`: local Postgres

## Commands
```bash
brew services start postgresql@16          # local Postgres :5432 (dbs: eneba, eneba_test); docker-compose planned
cd backend  && composer install && php artisan migrate:fresh --seed && php artisan serve   # :8000 (demo@example.com / password)
cd backend  && php artisan test            # PHPUnit, against local Postgres db `eneba_test`
cd backend  && ./vendor/bin/pint           # PHP formatting
cd frontend && npm i && npm run dev        # :5173 (UI kit at /dev/ui); VITE_API_URL in .env.local
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```
Run the relevant tests, typecheck and lint before calling a task done.

## Backend conventions
- All routes live in `routes/api.php` under the `/api/v1` prefix. Protected routes use `auth:sanctum`.
- **Thin controllers**: FormRequest validation → Service call → API Resource. No query logic in controllers.
- Domain logic goes in `app/Services/<Domain>/`. Swappable implementations get an interface (`PaymentGateway`, `BlockProvider`) bound in a service provider.
- Always return API Resources, never raw models or arrays of models. Keep response shapes stable, because the frontend types mirror them.
- **Money is integer cents** (`*_cents`) plus a `currency`. Never use floats for money.
- Never trust client prices. Re-price from `offers` at checkout.
- Wrap multi-step writes in `DB::transaction`. Lock keys with `lockForUpdate()->skipLocked()`.
- Webhooks must be idempotent (`payment_events.provider_event_id` unique) and signature-verified.
- `product_keys.status` changes only in `Services/Checkout/KeyReservations` (reserve at checkout with `lock('FOR UPDATE SKIP LOCKED')`: Laravel has no `skipLocked()`; sell / release / expire). Never call a payment provider while holding row locks.
- Order/cart lookups are scoped through `$request->user()->orders()` / `cartItems()`, so another user's id returns 404. UUID route params use `whereUuid`.
- Tests that need committed data (multiple connections/processes) use `Tests\Concerns\CommitsToDatabase`, not bare `DatabaseTruncation`, which leaks rows into later tests.
- Product key codes use the `encrypted` cast. Never log them or include them in list endpoints.
- Search logic lives only in `Services/Search/ProductSearch`. Catalog `q` and `/search/suggest` both use it. Tunables go in `config/search.php`.
- Every migration includes the indexes its query patterns need (see PLAN.md §3).
- Feature tests for every endpoint (happy path, auth/validation failure). Unit tests for search normalization, facets and key allocation.
- Postgres-specific SQL (pg_trgm, row locks, FILTER) is fine. Tests run against Postgres, not SQLite.
- Offer writes go through Eloquent so `OfferObserver` keeps product stats in sync. After any mass `Offer::query()->update()`/insert, run `php artisan catalog:sync-offer-stats`.
- Seeders must not use `WithoutModelEvents`: product `search_title` and offer stats depend on model events.

## Frontend conventions
- Code is organized by feature: `src/features/<feature>/{api.ts, hooks, components/, *Page.tsx, types.ts}`. Shared primitives go in `src/components/ui`.
- All HTTP goes through `src/lib/apiClient.ts`. No `fetch`/axios in components.
- Server state uses TanStack Query (query keys: `['products', params]`, `['product', slug]`, `['home']`, `['home-block', key]`, ...). Zustand only holds auth token and guest cart.
- Catalog filters, sort, page and `q` live in the **URL query string**. Don't duplicate them in state.
- **Homepage renders only what the backend sends.** Block order, titles and content come from `/home` and `/home/blocks/{key}`. Map `type → component` in `blockRegistry.ts`. Unknown types render nothing. Each block gets its own Suspense/skeleton and error boundary.
- Styling uses only Tailwind design tokens. `design/tokens.json` → `frontend/design-tokens.ts` → `tailwind.config.ts`, and the theme **replaces** Tailwind's colors and spacing (`bg-red-500`, `p-7` don't exist). Enforced three ways: ESLint bans hex literals, `no-raw-hex.test.ts` scans CSS/HTML/config, and `tailwind-classes.test.ts` fails on classes that generate no CSS. No inline styles. Reuse `components/ui` before creating new primitives.
- Token → class names: `color.bg.*` → `canvas-*` (`bg-canvas-base`), `color.text.*` → `fg-*` (`text-fg-muted`), `color.border.*` → `line-*`; `surface`, `overlay`, `accent`, `success`, `danger` keep their names. Spacing keys are px (`p-15` = 15px). Typography tokens are font sizes that also set line height and weight (`text-price-lg`, `text-title-card`). Component dimensions measured from the screens (`h-header`, `w-card`, `h-control-lg`, `max-w-content`) live in `theme.extend`, separate from tokens.
- `cn()` only joins classes, it does not resolve conflicts. Never pass a utility via `className` that the component already sets (display, font size…): put responsive visibility on a wrapper element, or add a prop (`size`, `variant`).
- Third-party/Eneba artwork marked "(reference — do not export)" in FIGMA_CLEANUP.md (logo, banners, payment and app-store logos, PC Mag, Trustpilot) is never reproduced. Icons are our own stroke SVGs in `components/ui/icons.tsx`.
- Mobile-first and responsive down to 360px. Every async view has loading (skeleton), empty and error states.
- Use strict TypeScript and no `any`. API types live in each feature's `types.ts` and mirror the Laravel Resources.
- **Adding a homepage block type:** backend: a `BlockProvider` class + one line in `config/home.php` (+ a seeded `home_blocks` row); frontend: a component using `useHomeBlock(key)` (render `null` when empty) + a skeleton + one entry in `features/home/blockRegistry.ts`. Never fetch block content outside its slot or hardcode block order/titles.
- Tests never touch the network: `src/test/setup.ts` makes unmocked `fetch` reject; use `mockApi()` (`'pending'` = never settles).
- **Cart:** read it only via `useCart()` / `useCartCount()` and change it only via `useCartActions()` / `useAddToCart()` (they branch guest ↔ signed in). Guest lines live in `guestCartStore`; never render them without `POST /cart/preview` prices.
- **Auth:** login/register go through `useAuthenticate()` (session + guest-cart merge + redirect); follow `?redirect=` only through `safeRedirect()`; guard pages with `<RequireAuth>`; log out with `useLogout()`.
- Format and parse money only with `lib/money.ts` (`formatMoney`, `eurosToCents`). URL and API prices stay in cents.
- Product images go through `CoverImage` (portrait capsule → header.jpg → fallback), never a bare `<img src={cover_url}>`.
- Store state: change it only through `useCatalogParams` / `catalogParams.ts` (canonical URL = one query-cache entry). Pagination and suggestions are links, not buttons.
- Tests: `waitFor`/`findBy*` don't drive Vitest fake timers, so test timing in hooks with fake timers and components with real timers. API calls in component tests go through `mockApi()`.
- "Done" means `npm run typecheck && npm run lint && npm test && npm run build`. Vitest alone misses type errors in test files (which then break `tsc -b` in the build).
- Accessibility: semantic elements, labelled inputs, a keyboard-navigable autocomplete, and visible focus rings.

## Styling / branding
- Match Eneba's look and feel (colors, typography, spacing, components) via tokens.
- Do **not** copy Eneba's logo, illustrations or other copyrighted assets. Use a text wordmark (`src/app/brand.ts`) and seed covers from public sources or placeholders.

## Git
- Small, focused commits in imperative mood (`Add product search service`). Branch off `main` for each milestone (`m3-store-search`).
- Never commit `.env` or secrets. `.env.example` files hold all required keys.

## Deploy notes
- Manual dashboard steps: `DEPLOY.md`. Infra as code: `render.yaml`, `backend/Dockerfile`, `backend/docker/entrypoint.d/60-release.sh`, `frontend/vercel.json`.
- Neon: `DB_URL` = pooled URL for the app (`DB_EMULATE_PREPARES=true`), `DB_DIRECT_URL` = direct URL, used by the `pgsql_direct` connection for migrations/seeding.
- Render: Docker image, `migrate --force` at container start (free plan has no pre-deploy hook), health check `/up`. CORS: `CORS_ALLOWED_ORIGINS` (Vercel origin; localhost:5173 by default), never `*`.
- New runtime origins (images, APIs) must be added to the CSP in `frontend/vercel.json`. Never change the production `APP_KEY` (it encrypts product keys).
- Stripe is in test mode only. `PAYMENT_DRIVER=fake|stripe`. Locally, forward webhooks with `stripe listen --forward-to localhost:8000/api/v1/payments/stripe/webhook`.
