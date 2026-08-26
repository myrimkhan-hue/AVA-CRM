CREATE TABLE "operating_expense_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operating_expense_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operating_expenses" (
    "id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "due_date" DATE NOT NULL,
    "purpose" TEXT NOT NULL,
    "is_recurring_monthly" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" DATE,
    "paid_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "recurring_source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operating_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operating_expense_types_is_active_sort_order_idx"
ON "operating_expense_types"("is_active", "sort_order");

CREATE UNIQUE INDEX "operating_expense_types_active_name_key"
ON "operating_expense_types"(LOWER("name"))
WHERE "deleted_at" IS NULL AND "is_active" = true;

CREATE UNIQUE INDEX "operating_expenses_recurring_source_id_due_date_key"
ON "operating_expenses"("recurring_source_id", "due_date");

CREATE INDEX "operating_expenses_due_date_idx" ON "operating_expenses"("due_date");
CREATE INDEX "operating_expenses_type_id_idx" ON "operating_expenses"("type_id");
CREATE INDEX "operating_expenses_legal_entity_id_idx" ON "operating_expenses"("legal_entity_id");
CREATE INDEX "operating_expenses_paid_at_idx" ON "operating_expenses"("paid_at");
CREATE INDEX "operating_expenses_unpaid_due_date_idx"
ON "operating_expenses"("due_date")
WHERE "paid_at" IS NULL AND "deleted_at" IS NULL;

ALTER TABLE "operating_expenses"
ADD CONSTRAINT "operating_expenses_type_id_fkey"
FOREIGN KEY ("type_id") REFERENCES "operating_expense_types"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "operating_expenses"
ADD CONSTRAINT "operating_expenses_legal_entity_id_fkey"
FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "operating_expenses"
ADD CONSTRAINT "operating_expenses_currency_code_fkey"
FOREIGN KEY ("currency_code") REFERENCES "currencies"("code")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "operating_expenses"
ADD CONSTRAINT "operating_expenses_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "operating_expenses"
ADD CONSTRAINT "operating_expenses_paid_by_user_id_fkey"
FOREIGN KEY ("paid_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operating_expenses"
ADD CONSTRAINT "operating_expenses_recurring_source_id_fkey"
FOREIGN KEY ("recurring_source_id") REFERENCES "operating_expenses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
