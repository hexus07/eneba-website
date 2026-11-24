# gamekeys — an Eneba-style key marketplace

A marketplace for digital game keys: store with filters, typo-tolerant search, a homepage built
from backend blocks, product pages with offers from several sellers, and a checkout that hands you
a key.

- **Live:** https://eneba-website.vercel.app
- **Demo account:** `demo@example.com` / `password`
- **Test card:** `4242 4242 4242 4242`, any future date, any CVC

The API is on Render's free plan, so the first load can take up to a minute while it wakes up.

## Stack

React + TypeScript (Vite, Tailwind, TanStack Query) on Vercel · Laravel 13 REST API on Render ·
PostgreSQL on Neon · Stripe test mode.

## What I went deep on

- **Search.** Uses Postgres trigrams, so typos and partial names work (`cyberpnk`, `witcehr`, `spiderman`).
  The autocomplete and the store share one search service.
- **Checkout.** Keys are reserved in a transaction with `FOR UPDATE SKIP LOCKED`, so two buyers
  can't get the same key. Prices are always recalculated on the server, and key codes are
  encrypted in the database.
- **Payments.** Stripe runs in test mode, so no real money is charged. The order is marked paid
  only after Stripe's webhook confirms the payment, and the webhook's signature is verified, so
  a payment can't be faked from the browser. Locally a fake driver replaces Stripe
  (`PAYMENT_DRIVER=fake`).
- **Homepage.** The backend decides which blocks appear and in what order, and each block loads
  its own data. Nothing on the homepage is hardcoded in the frontend.

Not included: reviews, wishlists, admin panel, multiple currencies. I'm not using Eneba's name
or logo, only the look.

## AI

Built with Claude Code, one milestone at a time, with a review after each one. The full logs are
in [`ai-logs/`](./ai-logs). Architecture is in [`PLAN.md`](./PLAN.md) and the deployment setup
is in [`DEPLOY.md`](./DEPLOY.md).

## Run locally

```bash
cd backend  && cp .env.example .env && composer install && php artisan key:generate \
            && php artisan migrate:fresh --seed && php artisan serve
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

Tests: `php artisan test` in `backend/` and `npm run test` in `frontend/`.
