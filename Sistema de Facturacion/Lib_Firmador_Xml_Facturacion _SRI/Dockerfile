FROM php:8.2-cli

# Instalar dependencias del sistema necesarias para Laravel + SRI
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libzip-dev \
    libxml2-dev \
    libssl-dev \
    unzip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Instalar extensiones PHP
# NOTA: openssl y xml ya vienen incluidos en php:8.2-cli, NO se instalan aquí
RUN docker-php-ext-install \
    zip \
    soap

# Instalar Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copiar composer files primero (aprovechar caché de Docker)
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Copiar el resto del código
COPY . .

# Permisos de Laravel
RUN mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/views \
    && chmod -R 775 storage bootstrap/cache

# Variables de entorno por defecto para producción
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_LEVEL=error \
    CACHE_DRIVER=file \
    SESSION_DRIVER=file \
    QUEUE_CONNECTION=sync \
    DB_CONNECTION=sqlite \
    DB_DATABASE=/tmp/laravel.sqlite

# Script de inicio: decodifica el .p12 desde env var y arranca Laravel
CMD php bootstrap/start.php && php artisan config:clear && php artisan serve --host=0.0.0.0 --port=${PORT:-8000}

EXPOSE 8000
