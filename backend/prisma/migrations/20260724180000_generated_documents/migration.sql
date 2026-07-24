-- CreateEnum
CREATE TYPE "GeneratedDocumentType" AS ENUM ('CONTRACT', 'TRANSPORT_REQUEST', 'INVOICE');

-- CreateTable
CREATE TABLE "document_number_counters" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_number_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "type" "GeneratedDocumentType" NOT NULL,
    "number" TEXT NOT NULL,
    "deal_id" TEXT,
    "transportation_id" TEXT,
    "generated_by_user_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_number_counters_key_key" ON "document_number_counters"("key");

-- CreateIndex
CREATE INDEX "generated_documents_deal_id_idx" ON "generated_documents"("deal_id");

-- CreateIndex
CREATE INDEX "generated_documents_transportation_id_idx" ON "generated_documents"("transportation_id");

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_transportation_id_fkey" FOREIGN KEY ("transportation_id") REFERENCES "transportations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
