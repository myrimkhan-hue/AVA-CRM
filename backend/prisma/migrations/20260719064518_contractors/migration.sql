-- CreateEnum
CREATE TYPE "ContractorType" AS ENUM ('CLIENT', 'CARRIER', 'CUSTOMS_BROKER', 'WAREHOUSE', 'SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentTerm" AS ENUM ('PREPAYMENT', 'POSTPAYMENT');

-- CreateTable
CREATE TABLE "contractors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "types" "ContractorType"[],
    "bin" TEXT,
    "country" TEXT,
    "legal_address" TEXT,
    "payment_term" "PaymentTerm",
    "postpayment_days" INTEGER,
    "notes" TEXT,
    "is_problem" BOOLEAN NOT NULL DEFAULT false,
    "problem_comment" TEXT,
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklist_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_contacts" (
    "id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,

    CONSTRAINT "contractor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_bank_accounts" (
    "id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "contractor_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contractor_contacts" ADD CONSTRAINT "contractor_contacts_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_bank_accounts" ADD CONSTRAINT "contractor_bank_accounts_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
