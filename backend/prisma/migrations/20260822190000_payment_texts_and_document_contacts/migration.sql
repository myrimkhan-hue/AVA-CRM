CREATE TYPE "DocumentPaymentTextType" AS ENUM (
    'PAYMENT_METHOD',
    'PAYMENT_CONDITIONS'
);

ALTER TABLE "users"
ADD COLUMN "document_name" TEXT,
ADD COLUMN "document_phone" TEXT;

CREATE TABLE "document_payment_texts" (
    "id" TEXT NOT NULL,
    "type" "DocumentPaymentTextType" NOT NULL,
    "short_name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_payment_texts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_payment_texts_type_is_active_sort_order_idx"
ON "document_payment_texts"("type", "is_active", "sort_order");

-- Для каждого вида формулировки может быть только одно значение по умолчанию.
CREATE UNIQUE INDEX "document_payment_texts_one_default_per_type_idx"
ON "document_payment_texts"("type")
WHERE "is_default" = true;
