-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "signed_at" DATE NOT NULL,
    "valid_until" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "terminated_at" DATE,
    "subject" TEXT,
    "notes" TEXT,
    "expiry_notified_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_contractor_id_idx" ON "contracts"("contractor_id");

-- CreateIndex
CREATE INDEX "contracts_legal_entity_id_idx" ON "contracts"("legal_entity_id");

-- CreateIndex
CREATE INDEX "contracts_valid_until_idx" ON "contracts"("valid_until");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

