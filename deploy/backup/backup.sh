#!/bin/sh
# Ежедневная резервная копия базы данных и файлов (вложения, шаблоны документов).
# Запускается контейнером "backup" из docker-compose.prod.yml (образ postgres:16-alpine,
# в котором уже есть pg_dump и busybox tar/gzip — отдельный Dockerfile не нужен).
set -eu

BACKUP_DIR=/backups
UPLOADS_DIR=/uploads
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

run_backup() {
  ts="$(date +%Y%m%d_%H%M%S)"
  echo "[backup] $(date) -- начинаю резервное копирование"

  db_file="$BACKUP_DIR/db_${ts}.sql.gz"
  # --clean --if-exists: дамп сам сносит старые объекты перед восстановлением,
  # поэтому restore можно накатывать прямо поверх рабочей базы без ручного DROP.
  if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      --clean --if-exists | gzip > "${db_file}.tmp"; then
    mv "${db_file}.tmp" "$db_file"
    echo "[backup] база сохранена: $db_file"
  else
    echo "[backup] ОШИБКА: не удалось снять дамп базы" >&2
    rm -f "${db_file}.tmp"
    return 1
  fi

  uploads_file="$BACKUP_DIR/uploads_${ts}.tar.gz"
  if [ -d "$UPLOADS_DIR" ] && [ -n "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    if tar czf "${uploads_file}.tmp" -C "$UPLOADS_DIR" .; then
      mv "${uploads_file}.tmp" "$uploads_file"
      echo "[backup] файлы сохранены: $uploads_file"
    else
      echo "[backup] ОШИБКА: не удалось заархивировать файлы" >&2
      rm -f "${uploads_file}.tmp"
      return 1
    fi
  else
    echo "[backup] папка вложений пуста -- архив файлов пропущен"
  fi

  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'uploads_*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete
  echo "[backup] $(date) -- готово, удалены копии старше ${RETENTION_DAYS} дней"
}

trap 'echo "[backup] остановлен"; exit 0' TERM INT

# Первая копия -- сразу при старте контейнера (в том числе после каждого
# передеплоя), дальше -- раз в сутки. Лишняя копия при частых передеплоях
# не страшна, старые всё равно чистит retention выше.
while :; do
  run_backup || echo "[backup] попытка не удалась, следующая -- через сутки"
  sleep 24h &
  wait $!
done
