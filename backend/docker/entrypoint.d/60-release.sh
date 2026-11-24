#!/bin/sh
# Runs at container start (serversideup/php executes /etc/entrypoint.d/*.sh in order), i.e. on
# every deploy and every wake-up from Render's free-tier sleep. Each step is idempotent.
set -e
cd /var/www/html

echo "[release] caching config, routes and events"
php artisan config:cache
php artisan route:cache
php artisan event:cache

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  # Neon direct (unpooled) endpoint for DDL; falls back to DB_URL when DB_DIRECT_URL is unset.
  echo "[release] migrating (connection: pgsql_direct)"
  php artisan migrate --force --database=pgsql_direct
fi

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  # CatalogSeeder skips itself when products exist; HomeSeeder and the demo user upsert.
  echo "[release] seeding demo data (skipped where already present)"
  php artisan db:seed --force --database=pgsql_direct
fi
