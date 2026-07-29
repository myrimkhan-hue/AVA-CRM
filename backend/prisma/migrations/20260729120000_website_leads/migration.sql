-- Заявки с сайта (раздел 4.6.3 ТЗ): новые поля лида и тип уведомления
ALTER TYPE "NotificationType" ADD VALUE 'WEBSITE_LEAD_RECEIVED';

ALTER TABLE "leads"
  ADD COLUMN "route_from" TEXT,
  ADD COLUMN "route_to" TEXT,
  ADD COLUMN "cargo_description" TEXT,
  ADD COLUMN "source_page" TEXT,
  ADD COLUMN "source_language" TEXT,
  ADD COLUMN "utm_source" TEXT,
  ADD COLUMN "utm_medium" TEXT,
  ADD COLUMN "utm_campaign" TEXT,
  ADD COLUMN "utm_content" TEXT,
  ADD COLUMN "utm_term" TEXT,
  ADD COLUMN "first_handled_at" TIMESTAMP(3);
