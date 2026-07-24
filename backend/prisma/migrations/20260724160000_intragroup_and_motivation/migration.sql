-- AlterEnum
ALTER TYPE "ContractorType" ADD VALUE 'GROUP_ENTITY';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "is_intragroup" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "legal_entities" ADD COLUMN     "contractor_id" TEXT;

-- AlterTable
ALTER TABLE "payment_requests" ADD COLUMN     "payer_legal_entity_id" TEXT,
ADD COLUMN     "reimbursement_invoice_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "motivation_rate_percent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "motivation_settings" (
    "id" TEXT NOT NULL,
    "bonus_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motivation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_is_intragroup_idx" ON "invoices"("is_intragroup");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entities_contractor_id_key" ON "legal_entities"("contractor_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_reimbursement_invoice_id_key" ON "payment_requests"("reimbursement_invoice_id");

-- CreateIndex
CREATE INDEX "payment_requests_payer_legal_entity_id_idx" ON "payment_requests"("payer_legal_entity_id");

-- AddForeignKey
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_payer_legal_entity_id_fkey" FOREIGN KEY ("payer_legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_reimbursement_invoice_id_fkey" FOREIGN KEY ("reimbursement_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Relax the "one active invoice per transportation" rule (subtask 3 revision) so an
-- internal intragroup reimbursement invoice can coexist with the regular client invoice.
DROP INDEX "invoices_transportation_id_key";

CREATE UNIQUE INDEX "invoices_transportation_id_key"
  ON "invoices"("transportation_id")
  WHERE "deleted_at" IS NULL AND "is_intragroup" = false;
