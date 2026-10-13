FROM php:8.5-apache-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    supervisor libicu-dev libzip-dev libonig-dev unzip \
    && docker-php-ext-install -j2 pdo_mysql mbstring intl zip pcntl opcache \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY . .
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod +x deploy/entrypoint.sh

COPY deploy/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/supervisord.conf /etc/supervisor/conf.d/washease.conf
RUN printf 'Listen 8080\n' > /etc/apache2/ports.conf \
    && printf 'StartServers 1\nMinSpareServers 1\nMaxSpareServers 2\nMaxRequestWorkers 4\nMaxConnectionsPerChild 500\n' > /etc/apache2/mods-available/mpm_prefork.conf \
    && printf 'ServerName localhost\n' > /etc/apache2/conf-available/servername.conf \
    && a2enconf servername \
    && printf 'memory_limit=96M\nexpose_php=Off\nopcache.enable=1\nopcache.memory_consumption=32\n' > /usr/local/etc/php/conf.d/washease.ini

EXPOSE 8080 8081
ENTRYPOINT ["/var/www/html/deploy/entrypoint.sh"]
