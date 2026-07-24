-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CALL_BACK', 'NOT_REACHED', 'NOT_INTERESTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "LeadNotInterestedReason" AS ENUM ('NOT_NEEDED', 'HAS_PROVIDER', 'EXPENSIVE', 'WRONG_CONTACT', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('COLD_CALL_IMPORT', 'WEBSITE');

-- CreateTable
CREATE TABLE "lead_import_batches" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "imported_by_user_id" TEXT NOT NULL,
    "rows_total" INTEGER NOT NULL,
    "rows_created" INTEGER NOT NULL,
    "rows_existing_client" INTEGER NOT NULL,
    "rows_duplicate_lead" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "bin" TEXT,
    "city" TEXT,
    "contact_name" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'COLD_CALL_IMPORT',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "not_interested_reason" "LeadNotInterestedReason",
    "not_interested_comment" TEXT,
    "call_back_at" TIMESTAMP(3),
    "not_reached_attempts" INTEGER NOT NULL DEFAULT 0,
    "is_existing_client" BOOLEAN NOT NULL DEFAULT false,
    "matched_contractor_id" TEXT,
    "responsible_id" TEXT,
    "department_id" TEXT,
    "import_batch_id" TEXT,
    "converted_deal_id" TEXT,
    "converted_contractor_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_status" "LeadStatus" NOT NULL,
    "to_status" "LeadStatus" NOT NULL,
    "comment" TEXT NOT NULL,
    "call_back_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_converted_deal_id_key" ON "leads"("converted_deal_id");

-- CreateIndex
CREATE INDEX "leads_responsible_id_idx" ON "leads"("responsible_id");

-- CreateIndex
CREATE INDEX "leads_department_id_idx" ON "leads"("department_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");

-- AddForeignKey
ALTER TABLE "lead_import_batches" ADD CONSTRAINT "lead_import_batches_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "lead_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_matched_contractor_id_fkey" FOREIGN KEY ("matched_contractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_contractor_id_fkey" FOREIGN KEY ("converted_contractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_deal_id_fkey" FOREIGN KEY ("converted_deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
