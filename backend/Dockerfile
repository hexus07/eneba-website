# Production image for Render: PHP 8.4 + nginx + php-fpm (serversideup/php), listening on :8080.
# Build context: backend/. Releases (config cache, migrations, optional seed) run at container start
# from docker/entrypoint.d/60-release.sh, since Render's free plan has no pre-deploy command.

FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist --ignore-platform-req=php
COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative --no-scripts

FROM serversideup/php:8.4-fpm-nginx AS app

ENV PHP_OPCACHE_ENABLE=1 \
    PHP_OPCACHE_VALIDATE_TIMESTAMPS=0 \
    LOG_CHANNEL=stderr \
    APP_ENV=production \
    APP_DEBUG=false \
    NGINX_WEBROOT=/var/www/html/public \
    HEALTHCHECK_PATH=/up

WORKDIR /var/www/html
COPY --chown=www-data:www-data --from=vendor /app /var/www/html
COPY --chmod=755 docker/entrypoint.d/ /etc/entrypoint.d/

USER root
RUN rm -f .env && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data

EXPOSE 8080
