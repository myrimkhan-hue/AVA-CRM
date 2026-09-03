#!/bin/sh
set -eu

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
    exec npm run start:dev
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
