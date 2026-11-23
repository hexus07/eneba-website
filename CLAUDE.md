# CLAUDE.md

Eneba-style digital-key marketplace. **Read `PLAN.md` first.** It is the source of truth for scope, data model and API. Update it when a decision changes.

## Layout
- `frontend/`: React 18 + TypeScript + Vite + Tailwind, TanStack Query, React Router, Zustand
- `backend/`: Laravel 13, API only, PostgreSQL, Sanctum bearer tokens
- `docker-compose.yml`: local Postgres

## Commands
```bash
brew services start postgresql@16          # local Postgres :5432 (dbs: eneba, eneba_test); docker-compose planned
cd backend  && composer install && php artisan migrate:fresh --seed && php artisan serve   # :8000 (demo@example.com / password)
cd backend  && php artisan test            # PHPUnit, against local Postgres db `eneba_test`
cd backend  && ./vendor/bin/pint           # PHP formatting
cd frontend && npm i && npm run dev        # :5173
cd frontend && npm run typecheck && npm run lint && npm run test
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
- Styling uses only Tailwind design tokens from `tailwind.config.ts`. No raw hex values or inline styles in features. Reuse `components/ui` before creating new primitives.
- Mobile-first and responsive down to 360px. Every async view has loading (skeleton), empty and error states.
- Use strict TypeScript and no `any`. API types live in each feature's `types.ts` and mirror the Laravel Resources.
- Format money only with `lib/money.ts`.
- Accessibility: semantic elements, labelled inputs, a keyboard-navigable autocomplete, and visible focus rings.

## Styling / branding
- Match Eneba's look and feel (colors, typography, spacing, components) via tokens.
- Do **not** copy Eneba's logo, illustrations or other copyrighted assets. Use a text wordmark and seed covers from public sources or placeholders.

## Git
- Small, focused commits in imperative mood (`Add product search service`). Branch off `main` for each milestone (`m3-store-search`).
- Never commit `.env` or secrets. `.env.example` files hold all required keys.

## Deploy notes
- Neon: use the pooled URL for the app (`PDO::ATTR_EMULATE_PREPARES => true`) and the direct URL for migrations.
- Render: Docker image, `migrate --force` on release, health check `/up`. CORS allows only the Vercel origin and `localhost:5173`.
- Stripe is in test mode only. `PAYMENT_DRIVER=fake|stripe`.
