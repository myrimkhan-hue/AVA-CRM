-- Новые данные, необходимые для однозначной повторной сборки документа.
ALTER TABLE "generated_documents"
ADD COLUMN "transportation_leg_id" TEXT,
ADD COLUMN "invoice_id" TEXT,
ADD COLUMN "generation_data" JSONB;

-- Номер счёта уникален, поэтому старые записи счетов можно связать однозначно.
-- Дополнительная проверка перевозки защищает от ошибочной связи повреждённых данных.
UPDATE "generated_documents" AS "gd"
SET "invoice_id" = "i"."id"
FROM "invoices" AS "i"
WHERE "gd"."type" = 'INVOICE'
  AND "gd"."invoice_id" IS NULL
  AND "gd"."number" = "i"."number"
  AND (
    "gd"."transportation_id" IS NULL
    OR "gd"."transportation_id" = "i"."transportation_id"
  );

-- Участок старой заявки заполняется только при единственном совпадении
-- перевозки и контрагента. Неоднозначные записи намеренно остаются без ссылки.
WITH "unique_leg_matches" AS (
  SELECT
    "gd"."id" AS "generated_document_id",
    MIN("tl"."id") AS "transportation_leg_id"
  FROM "generated_documents" AS "gd"
  INNER JOIN "transportation_legs" AS "tl"
    ON "tl"."transportation_id" = "gd"."transportation_id"
    AND "tl"."subcontractor_id" = "gd"."contractor_id"
  WHERE "gd"."type" = 'TRANSPORT_REQUEST'
    AND "gd"."transportation_leg_id" IS NULL
    AND "gd"."transportation_id" IS NOT NULL
    AND "gd"."contractor_id" IS NOT NULL
  GROUP BY "gd"."id"
  HAVING COUNT(*) = 1
)
UPDATE "generated_documents" AS "gd"
SET "transportation_leg_id" = "matches"."transportation_leg_id"
FROM "unique_leg_matches" AS "matches"
WHERE "gd"."id" = "matches"."generated_document_id";

CREATE INDEX "generated_documents_transportation_leg_id_idx"
ON "generated_documents"("transportation_leg_id");

CREATE INDEX "generated_documents_invoice_id_idx"
ON "generated_documents"("invoice_id");

CREATE INDEX "generated_documents_legal_entity_id_idx"
ON "generated_documents"("legal_entity_id");

CREATE INDEX "generated_documents_generated_by_user_id_idx"
ON "generated_documents"("generated_by_user_id");

CREATE INDEX "generated_documents_type_idx"
ON "generated_documents"("type");

CREATE INDEX "generated_documents_generated_at_idx"
ON "generated_documents"("generated_at");

ALTER TABLE "generated_documents"
ADD CONSTRAINT "generated_documents_transportation_leg_id_fkey"
FOREIGN KEY ("transportation_leg_id") REFERENCES "transportation_legs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_documents"
ADD CONSTRAINT "generated_documents_invoice_id_fkey"
FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
