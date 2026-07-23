ALTER TABLE "invoices"
  ADD COLUMN "transportation_id" TEXT;

WITH ranked_invoices AS (
  SELECT
    "id",
    "deal_id",
    ROW_NUMBER() OVER (
      PARTITION BY "deal_id"
      ORDER BY "created_at", "id"
    ) AS position
  FROM "invoices"
),
ranked_transportations AS (
  SELECT
    "id",
    "deal_id",
    ROW_NUMBER() OVER (
      PARTITION BY "deal_id"
      ORDER BY "sequence_in_deal", "created_at", "id"
    ) AS position
  FROM "transportations"
)
UPDATE "invoices" AS invoice
SET "transportation_id" = transportation."id"
FROM ranked_invoices AS ranked_invoice
JOIN ranked_transportations AS transportation
  ON transportation."deal_id" = ranked_invoice."deal_id"
 AND transportation.position = ranked_invoice.position
WHERE invoice."id" = ranked_invoice."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "invoices"
    WHERE "transportation_id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot migrate invoices: an existing invoice has no matching transportation';
  END IF;
END
$$;

ALTER TABLE "invoices"
  DROP CONSTRAINT "invoices_deal_id_fkey";

DROP INDEX "invoices_deal_id_idx";

ALTER TABLE "invoices"
  DROP COLUMN "deal_id",
  ALTER COLUMN "transportation_id" SET NOT NULL;

CREATE UNIQUE INDEX "invoices_transportation_id_key"
  ON "invoices"("transportation_id");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_transportation_id_fkey"
  FOREIGN KEY ("transportation_id") REFERENCES "transportations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
