DROP INDEX "invoices_transportation_id_key";

CREATE UNIQUE INDEX "invoices_transportation_id_key"
  ON "invoices"("transportation_id")
  WHERE "deleted_at" IS NULL;
