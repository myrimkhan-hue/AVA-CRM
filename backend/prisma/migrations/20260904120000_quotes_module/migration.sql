-- CreateEnum
CREATE TYPE "DeliveryTerms" AS ENUM ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP');

-- AlterTable
ALTER TABLE "contractors" ADD COLUMN "is_prospect" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "deals"
ADD COLUMN "client_target_rate" DECIMAL(18,2),
ADD COLUMN "client_target_rate_currency" VARCHAR(3),
ADD COLUMN "quote_rate_date" DATE;

-- AlterTable
ALTER TABLE "transportations"
ADD COLUMN "delivery_terms" "DeliveryTerms",
ADD COLUMN "cargo_ready_date" DATE;

-- CreateTable
CREATE TABLE "quote_options" (
    "id" TEXT NOT NULL,
    "transportation_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "vehicle_type" TEXT,
    "carrier_id" TEXT,
    "cost_rate" DECIMAL(18,2),
    "cost_rate_currency" VARCHAR(3),
    "client_rate" DECIMAL(18,2),
    "client_rate_currency" VARCHAR(3),
    "transit_days" INTEGER,
    "notes" TEXT,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_number_sequences" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL,

    CONSTRAINT "quote_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contractors_is_prospect_idx" ON "contractors"("is_prospect");

-- CreateIndex
CREATE UNIQUE INDEX "quote_options_transportation_id_sequence_key" ON "quote_options"("transportation_id", "sequence");

-- CreateIndex
CREATE INDEX "quote_options_transportation_id_idx" ON "quote_options"("transportation_id");

-- CreateIndex
CREATE INDEX "quote_options_carrier_id_idx" ON "quote_options"("carrier_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_number_sequences_legal_entity_id_year_key" ON "quote_number_sequences"("legal_entity_id", "year");

-- AddForeignKey
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_transportation_id_fkey" FOREIGN KEY ("transportation_id") REFERENCES "transportations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_number_sequences" ADD CONSTRAINT "quote_number_sequences_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
