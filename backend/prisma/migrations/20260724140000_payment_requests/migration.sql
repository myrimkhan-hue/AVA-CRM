CREATE TYPE "PaymentRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID');

CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "transportation_id" TEXT NOT NULL,
    "leg_id" TEXT,
    "payee_contractor_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "due_date" DATE NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_by_user_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_requests_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "payment_requests_purpose_check" CHECK (length(btrim("purpose")) > 0)
);

CREATE INDEX "payment_requests_transportation_id_idx"
ON "payment_requests"("transportation_id");

CREATE INDEX "payment_requests_leg_id_idx"
ON "payment_requests"("leg_id");

CREATE INDEX "payment_requests_payee_contractor_id_idx"
ON "payment_requests"("payee_contractor_id");

CREATE INDEX "payment_requests_status_idx"
ON "payment_requests"("status");

CREATE INDEX "payment_requests_due_date_idx"
ON "payment_requests"("due_date");

ALTER TABLE "payment_requests"
ADD CONSTRAINT "payment_requests_transportation_id_fkey"
FOREIGN KEY ("transportation_id") REFERENCES "transportations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
ADD CONSTRAINT "payment_requests_leg_id_fkey"
FOREIGN KEY ("leg_id") REFERENCES "transportation_legs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
ADD CONSTRAINT "payment_requests_payee_contractor_id_fkey"
FOREIGN KEY ("payee_contractor_id") REFERENCES "contractors"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
ADD CONSTRAINT "payment_requests_currency_code_fkey"
FOREIGN KEY ("currency_code") REFERENCES "currencies"("code")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
ADD CONSTRAINT "payment_requests_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
ADD CONSTRAINT "payment_requests_approved_by_user_id_fkey"
FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
ADD CONSTRAINT "payment_requests_paid_by_user_id_fkey"
FOREIGN KEY ("paid_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
