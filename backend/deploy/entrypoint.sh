#!/bin/sh
set -eu

: "${APP_KEY:?Set a persistent APP_KEY in Northflank runtime secrets}"
: "${DB_HOST:?Link the private MySQL host}"
: "${DB_DATABASE:?Set the database name}"
: "${DB_USERNAME:?Link the database username}"
: "${DB_PASSWORD:?Link the database password}"
: "${REVERB_APP_ID:?Set the Reverb application ID}"
: "${REVERB_APP_KEY:?Set the Reverb public application key}"
: "${REVERB_APP_SECRET:?Set the Reverb application secret}"
: "${MYSQL_SSL_CA_BASE64:?Set the base64 encoded Northflank MySQL CA certificate}"

umask 027
printf '%s' "$MYSQL_SSL_CA_BASE64" | base64 -d > /tmp/washease-mysql-ca.pem
chown www-data:www-data /tmp/washease-mysql-ca.pem
chmod 640 /tmp/washease-mysql-ca.pem
export MYSQL_ATTR_SSL_CA=/tmp/washease-mysql-ca.pem

export APP_ENV=production APP_DEBUG=false DB_CONNECTION=mysql
export QUEUE_CONNECTION=database CACHE_STORE=database SESSION_DRIVER=database
export LOG_CHANNEL=stderr LOG_LEVEL=warning
export BROADCAST_CONNECTION=reverb
export REVERB_HOST=127.0.0.1 REVERB_PORT=8081 REVERB_SCHEME=http
export REVERB_SERVER_HOST=0.0.0.0 REVERB_SERVER_PORT=8081

php artisan config:cache --no-interaction
php artisan route:cache --no-interaction
php artisan view:cache --no-interaction
chown -R www-data:www-data storage bootstrap/cache

# Initial schema creation is an explicit one-time deployment step.
# Never migrate or seed implicitly on every web container restart.
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/washease.conf
