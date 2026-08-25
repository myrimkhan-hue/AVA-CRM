ALTER TYPE "DocumentTemplateType" ADD VALUE 'INVOICE';

ALTER TABLE "legal_entities"
ADD COLUMN "kbe" TEXT,
ADD COLUMN "payment_purpose_code" TEXT;
