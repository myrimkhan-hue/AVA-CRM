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

Сейчас бизнес-моделей нет, поэтому первая миграция будет нужна после их добавления. При запущенных контейнерах:

```bash
docker compose exec backend npx prisma migrate dev --name init
```

Для применения уже созданных миграций в боевом окружении:

```bash
docker compose exec backend npx prisma migrate deploy
```

Проверка API:

```bash
curl http://localhost:3000/api/health
```
