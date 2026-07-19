-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('NEW', 'RATE_CALCULATION', 'RATE_SENT', 'AGREED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DealRejectReason" AS ENUM ('EXPENSIVE', 'TIMING', 'COMPETITOR', 'NO_CONTACT', 'OTHER');

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "responsible_id" TEXT NOT NULL,
    "department_id" TEXT,
    "stage" "DealStage" NOT NULL DEFAULT 'NEW',
    "reject_reason" "DealRejectReason",
    "reject_comment" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_number_sequences" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL,

    CONSTRAINT "deal_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deals_number_key" ON "deals"("number");

-- CreateIndex
CREATE UNIQUE INDEX "deal_number_sequences_legal_entity_id_year_key" ON "deal_number_sequences"("legal_entity_id", "year");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_number_sequences" ADD CONSTRAINT "deal_number_sequences_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
