# CRM AVA Solution

Базовый монорепозиторий: NestJS + Prisma + PostgreSQL в `backend/` и React + Vite + Ant Design в `frontend/`.

## Запуск через Docker

При необходимости скопируйте `.env.example` в `.env` и измените локальные настройки. Без `.env` Compose использует безопасные только для разработки значения по умолчанию.

```bash
docker compose up --build
```

- Backend health: http://localhost:3000/api/health
- Frontend: http://localhost:5173
- PostgreSQL: `localhost:5432`

## Миграции Prisma

Миграции базы данных применяются автоматически при старте backend-контейнера. Запускать их вручную не нужно.

При первом запуске на чистой машине укажите в `.env` электронную почту и пароль первого администратора:

```env
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=надёжный-пароль
```

Затем создайте администратора и начальные данные:

```bash
docker compose run --rm backend seed
```

Без этого шага войти в CRM будет некому.

При изменении схемы базы данных новую миграцию создают командой:

```bash
docker compose exec backend npx prisma migrate dev --name <имя>
```

Проверка API:

```bash
curl http://localhost:3000/api/health
```
