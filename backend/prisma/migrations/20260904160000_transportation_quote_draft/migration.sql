-- AlterTable
ALTER TABLE "transportations"
ADD COLUMN "is_quote_draft" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "transportations_is_quote_draft_idx" ON "transportations"("is_quote_draft");
