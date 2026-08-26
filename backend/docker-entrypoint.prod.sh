#!/bin/sh
set -eu

require_value() {
  variable_name="$1"
  eval "variable_value=\${$variable_name:-}"
  if [ -z "$variable_value" ]; then
    echo "ОШИБКА: обязательная переменная $variable_name не задана." >&2
    exit 1
  fi
}

require_value POSTGRES_USER
require_value POSTGRES_PASSWORD
require_value POSTGRES_DB

# URL собирается внутри контейнера, чтобы пароль с @, :, / и другими символами
# корректно кодировался и не ломал DATABASE_URL.
DATABASE_URL="$(node <<'NODE'
const encode = (value) => encodeURIComponent(value);
const user = encode(process.env.POSTGRES_USER);
const password = encode(process.env.POSTGRES_PASSWORD);
const database = encode(process.env.POSTGRES_DB);
process.stdout.write(`postgresql://${user}:${password}@postgres:5432/${database}?schema=public`);
NODE
)"
export DATABASE_URL

apply_migrations() {
  echo "Применение миграций базы данных..."
  if ! /app/node_modules/.bin/prisma migrate deploy --schema /app/backend/prisma/schema.prisma; then
    echo "ОШИБКА: миграции базы данных не применились. Backend не будет запущен на несовместимой схеме." >&2
    exit 1
  fi
  echo "Миграции базы данных применены."
}

case "${1:-start}" in
  start)
    apply_migrations
    exec node dist/main.js
    ;;
  seed)
    apply_migrations
    exec npm run prisma:seed --workspace @ava-crm/backend
    ;;
  migrate)
    apply_migrations
    ;;
  *)
    exec "$@"
    ;;
esac
