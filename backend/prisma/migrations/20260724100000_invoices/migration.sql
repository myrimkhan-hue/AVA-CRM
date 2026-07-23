CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PARTIALLY_PAID', 'PAID');

CREATE TABLE "invoice_number_sequences" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL,
    CONSTRAINT "invoice_number_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoices_dates_check" CHECK ("due_date" >= "issue_date")
);

CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "service_name" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "has_vat" BOOLEAN NOT NULL,
    "vat_rate_percent" DECIMAL(5,2),
    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_lines_values_check"
      CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "sort_order" > 0),
    CONSTRAINT "invoice_lines_vat_check"
      CHECK (
        ("has_vat" = true AND "vat_rate_percent" IS NOT NULL
          AND "vat_rate_percent" >= 0 AND "vat_rate_percent" <= 100)
        OR
        ("has_vat" = false AND "vat_rate_percent" IS NULL)
      )
);

CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "manual_exchange_rate" DECIMAL(18,6),
    "note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_payments_values_check"
      CHECK ("amount" > 0 AND ("manual_exchange_rate" IS NULL OR "manual_exchange_rate" > 0))
);

CREATE UNIQUE INDEX "invoice_number_sequences_legal_entity_id_year_key"
  ON "invoice_number_sequences"("legal_entity_id", "year");
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");
CREATE INDEX "invoices_deal_id_idx" ON "invoices"("deal_id");
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");
CREATE INDEX "invoices_legal_entity_id_idx" ON "invoices"("legal_entity_id");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");
CREATE UNIQUE INDEX "invoice_lines_invoice_id_sort_order_key"
  ON "invoice_lines"("invoice_id", "sort_order");
CREATE INDEX "invoice_payments_invoice_id_payment_date_idx"
  ON "invoice_payments"("invoice_id", "payment_date");

ALTER TABLE "invoice_number_sequences"
  ADD CONSTRAINT "invoice_number_sequences_legal_entity_id_fkey"
  FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_legal_entity_id_fkey"
  FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_code_fkey"
  FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
