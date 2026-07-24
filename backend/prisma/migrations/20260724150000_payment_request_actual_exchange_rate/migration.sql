ALTER TABLE "payment_requests"
ADD COLUMN "actual_exchange_rate" DECIMAL(18,6);

ALTER TABLE "payment_requests"
ADD CONSTRAINT "payment_requests_actual_exchange_rate_check"
CHECK ("actual_exchange_rate" IS NULL OR "actual_exchange_rate" > 0);
