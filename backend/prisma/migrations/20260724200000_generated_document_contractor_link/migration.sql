-- AlterTable
ALTER TABLE "generated_documents" ADD COLUMN     "contractor_id" TEXT,
ADD COLUMN     "legal_entity_id" TEXT;

-- CreateIndex
CREATE INDEX "generated_documents_contractor_id_idx" ON "generated_documents"("contractor_id");

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
