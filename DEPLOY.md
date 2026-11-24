# Deploying gamekeys

| Part | Where | Config in this repo |
|---|---|---|
| API (Laravel 13, PHP 8.4) | **Render** web service, Docker, free plan, Frankfurt | `render.yaml`, `backend/Dockerfile`, `backend/docker/entrypoint.d/60-release.sh` |
| Database (Postgres) | **Neon**, AWS eu-central-1 (Frankfurt) | pooled URL for the app, direct URL for migrations |
| Frontend (React SPA) | **Vercel**, root directory `frontend` | `frontend/vercel.json` (SPA routing, caching, CSP) |

Everything below is what you click and paste. Do it in this order: the database first, then
the API, then the frontend, then point CORS at the frontend.

Already done for you: the image was built and run locally against Postgres 16 behind PgBouncer in
transaction mode (what Neon's pooler is). Migrations ran over the direct connection, the demo data
was seeded, and a full purchase worked through the pooled connection. The production frontend build
loaded with the CSP from `vercel.json` in force, with no violations.

---

## 0. Before you start

- The code is on GitHub at `github.com/hexus07/eneba-website`, and `main` contains this deploy
  configuration (Render and Vercel deploy from `main`).
- Generate the app key **once** and keep it somewhere safe (a password manager):

  ```bash
  cd backend && php artisan key:generate --show
  # → base64:…  (copy the whole string, including "base64:")
  ```

  ⚠️ **Never change `APP_KEY` after the first deploy.** It encrypts every product key in the
  database and signs their uniqueness hashes. A new key makes all existing keys unreadable.

---

## 1. Neon (database), about 3 minutes

1. Sign up at <https://neon.tech> (signing in with GitHub works).
2. **Create project**:
   - Name: `gamekeys`
   - Postgres version: 16 or 17 (both work)
   - Region: **AWS Europe Central 1 (Frankfurt)**, the same region as the Render service
3. On the project dashboard click **Connect**. You need **two** connection strings, both for the
   default branch, database `neondb` and the default role:
   - **Connection pooling ON**: the host contains `-pooler`. This is **`DB_URL`**.
   - **Connection pooling OFF**: same host without `-pooler`. This is **`DB_DIRECT_URL`**.

   They look like
   `postgresql://neondb_owner:•••@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`.
   Copy them exactly as shown (the `sslmode=require` part is needed).

You don't need to create any tables: the API migrates and seeds on its first start.

---

## 2. Render (API), about 10 minutes, mostly waiting for the first build

1. Sign up at <https://render.com> **with GitHub**, and give Render access to the
   `eneba-website` repository when asked.
2. **New → Blueprint**, pick `hexus07/eneba-website`, branch `main`. Render reads `render.yaml` and
   shows one service, **`gamekeys-api`** (Docker, Free, Frankfurt).
3. It asks for the values marked `sync: false`. Fill them in:

   | Variable | Value |
   |---|---|
   | `APP_KEY` | the `base64:…` string from step 0 |
   | `APP_URL` | `https://gamekeys-api.onrender.com` (if Render gives the service a different URL, update this afterwards) |
   | `DB_URL` | Neon **pooled** string (host with `-pooler`) |
   | `DB_DIRECT_URL` | Neon **direct** string (host without `-pooler`) |
   | `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` for now. You set the real Vercel URL in step 4 |

   All other variables already have values from `render.yaml`. Don't edit those.
4. **Apply**. The first build takes about 5–8 minutes. In the service's **Logs** you should see:

   ```
   [release] migrating (connection: pgsql_direct)
   … 16 migrations DONE
   [release] seeding demo data (skipped where already present)
   Seeded 323 products, 1277 offers, 14823 keys.
   ```

   followed by Render marking the deploy **Live** once `/up` answers.
5. Check it in a browser:
   - `https://<your-service>.onrender.com/up`: a green "Application up" page
   - `https://<your-service>.onrender.com/api/v1/home`: JSON with 7 blocks

   Note the exact service URL. The frontend needs it in the next step.

---

## 3. Vercel (frontend), about 3 minutes

1. Sign up at <https://vercel.com> **with GitHub**, and allow access to `eneba-website`.
2. **Add New… → Project → Import** `hexus07/eneba-website`.
3. Configure the project:
   - **Root Directory**: `frontend` (click *Edit* and pick the folder)
   - Framework preset: **Vite** (detected automatically; build and output settings come from `vercel.json`)
   - Under *Root Directory*, keep **"Include files outside of the root directory in the Build
     Step"** enabled (it's on by default). The build reads `../design/tokens.json`.
   - **Environment Variables**: add

     | Name | Value |
     |---|---|
     | `VITE_API_URL` | `https://<your-service>.onrender.com` (no trailing slash, no `/api/v1`) |
4. **Deploy**. When it finishes, note the production URL, for example `https://eneba-website.vercel.app`
   (*Project → Domains* lists it).

`VITE_API_URL` is baked in at build time. If you change it later, **redeploy** (*Deployments → … → Redeploy*).

---

## 4. Allow the frontend to call the API (CORS), 1 minute

1. Render → `gamekeys-api` → **Environment** → edit `CORS_ALLOWED_ORIGINS`:
   - set it to the exact Vercel production URL, e.g. `https://eneba-website.vercel.app`
     (scheme included, **no trailing slash**; separate several with commas)
2. *(Optional)* To let Vercel **preview** deployments call the API too, add
   `CORS_ALLOWED_ORIGIN_PATTERNS` with a regex for your preview URLs, e.g.
   `#^https://eneba-website-[a-z0-9-]+-hexus07s-projects\.vercel\.app$#`
   (check a real preview URL under *Deployments* and adjust the project and scope parts).
3. **Save, rebuild and deploy** (Render restarts the service with the new value).

---

## 5. Smoke test, 5 minutes

Open the Vercel URL:

- [ ] Homepage shows the gradient hero, Best sellers, Top deals, and the other blocks
- [ ] Typing `eldn` in the search box suggests **Elden Ring** first
- [ ] `/store`: filters, facet counts and sorting work; `/store?q=eldn rng` shows "Did you mean Elden Ring?"
- [ ] A product page shows offers from several sellers
- [ ] Log in as **`demo@example.com` / `password`** (or register), add to cart, **Place order**,
      **Pay**, then **Reveal key**: the order appears in *My orders*

If the first request takes about 50 s, that's Render's free tier waking up, not an error (see below).

---

## Good to know

- **Cold starts**: free Render services sleep after 15 minutes without traffic. The next request
  waits about 30–60 s while the container starts. The release script runs again, but it's
  idempotent: "Nothing to migrate", "Catalog already seeded; skipping". Neon's free compute also
  pauses after 5 minutes idle and wakes in under a second. The frontend shows "the server may be
  waking up" with a *Try again* button.
- **Reservation expiry**: Render's free plan has no cron. Expired reservations are released inline
  on every checkout, so stock is never held by abandoned orders. The scheduled
  `orders:expire-reservations` only runs where a scheduler exists.
- **Payments** are simulated (`PAYMENT_DRIVER=fake`, no real money). Stripe test mode is
  implemented on the backend, but the frontend has no Stripe card form yet, so leave it on `fake`.
- **Redeploys** happen automatically on every push to `main`: the API only when `backend/**`
  changes (`buildFilter`), and the frontend on any change.
- **Resetting the demo data**: run this from your machine against the **direct** URL, with the
  **same** `APP_KEY`:

  ```bash
  cd backend
  DB_URL='<neon direct url>' APP_KEY='<the production key>' php artisan migrate:fresh --seed --force
  ```

- **Secrets** live only in the Render and Vercel dashboards (`sync: false` in `render.yaml`).
  Nothing secret is committed.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Frontend loads, every API call fails, console says "blocked by CORS policy" | `CORS_ALLOWED_ORIGINS` doesn't exactly match the Vercel URL (scheme, no trailing slash) → fix it and redeploy the API |
| Console says "Refused to connect … Content Security Policy" | The API isn't on `*.onrender.com` (custom domain?) → add its origin to `connect-src` in `frontend/vercel.json` |
| Render deploy fails at `[release] migrating` | `DB_DIRECT_URL` missing or wrong; it must be the **non-pooler** Neon host |
| 500 errors mentioning "prepared statement" | `DB_EMULATE_PREPARES` isn't `true` while `DB_URL` points at the pooler |
| Keys in old orders show as unreadable | `APP_KEY` was changed. Restore the original |
| API calls go to `localhost:8000` | `VITE_API_URL` wasn't set when Vercel built → set it and redeploy |
