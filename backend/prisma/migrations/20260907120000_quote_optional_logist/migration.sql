ALTER TABLE "transportations" ALTER COLUMN "logist_id" DROP NOT NULL;

ALTER TABLE "transportations"
ADD CONSTRAINT "transportations_real_logist_check"
CHECK (is_quote_draft = true OR logist_id IS NOT NULL);
