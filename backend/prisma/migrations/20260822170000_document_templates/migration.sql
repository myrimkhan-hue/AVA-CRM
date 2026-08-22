CREATE TYPE "DocumentTemplateType" AS ENUM ('CONTRACT', 'TRANSPORT_REQUEST');

CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_templates_size_bytes_check" CHECK ("size_bytes" > 0)
);

CREATE UNIQUE INDEX "document_templates_stored_name_key"
ON "document_templates"("stored_name");

CREATE INDEX "document_templates_type_uploaded_at_idx"
ON "document_templates"("type", "uploaded_at");

CREATE INDEX "document_templates_uploaded_by_user_id_idx"
ON "document_templates"("uploaded_by_user_id");

-- Индекс не даёт двум параллельным операциям оставить активными
-- две версии одного типа, даже если обе прошли проверку приложения.
CREATE UNIQUE INDEX "document_templates_one_active_per_type_idx"
ON "document_templates"("type")
WHERE "is_active" = true;

ALTER TABLE "document_templates"
ADD CONSTRAINT "document_templates_uploaded_by_user_id_fkey"
FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
