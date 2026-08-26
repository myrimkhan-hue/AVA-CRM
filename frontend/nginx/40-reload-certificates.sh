#!/bin/sh
set -eu

if [ "${NGINX_MODE:-tls}" = "tls" ]; then
  # Certbot обновляет файлы в общем томе. Периодический reload заставляет nginx
  # подхватить новый сертификат без перерыва в работе.
  (
    while sleep 21600; do
      nginx -s reload || true
    done
  ) &
fi
