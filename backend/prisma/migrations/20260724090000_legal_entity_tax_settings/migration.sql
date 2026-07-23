-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('GENERAL', 'SIMPLIFIED', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxRateKind" AS ENUM ('VAT', 'INCOME_TAX');

-- AlterTable
ALTER TABLE "legal_entities"
ADD COLUMN "tax_regime" "TaxRegime" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "legal_entity_tax_rates" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "kind" "TaxRateKind" NOT NULL,
    "rate_percent" DECIMAL(5,2) NOT NULL,
    "is_vat_payer" BOOLEAN,
    "effective_from" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "legal_entity_tax_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "legal_entity_tax_rates_rate_percent_check"
        CHECK ("rate_percent" >= 0 AND "rate_percent" <= 100),
    CONSTRAINT "legal_entity_tax_rates_vat_payer_check"
        CHECK (
            ("kind" = 'VAT' AND "is_vat_payer" IS NOT NULL)
            OR
            ("kind" = 'INCOME_TAX' AND "is_vat_payer" IS NULL)
        )
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_entity_tax_rates_legal_entity_id_kind_effective_fr_key"
ON "legal_entity_tax_rates"("legal_entity_id", "kind", "effective_from");

-- CreateIndex
CREATE INDEX "legal_entity_tax_rates_legal_entity_id_kind_effective_fro_idx"
ON "legal_entity_tax_rates"("legal_entity_id", "kind", "effective_from");

-- AddForeignKey
ALTER TABLE "legal_entity_tax_rates"
ADD CONSTRAINT "legal_entity_tax_rates_legal_entity_id_fkey"
FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_entity_tax_rates"
ADD CONSTRAINT "legal_entity_tax_rates_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
