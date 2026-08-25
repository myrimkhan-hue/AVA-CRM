-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT_EXPIRING';

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "expiry_escalated_at" TIMESTAMP(3);
