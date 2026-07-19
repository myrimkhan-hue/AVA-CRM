-- DropForeignKey
ALTER TABLE "transportation_legs" DROP CONSTRAINT "transportation_legs_carrier_id_fkey";

-- DropForeignKey
ALTER TABLE "transportation_status_events" DROP CONSTRAINT "transportation_status_events_changed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "transportations" DROP CONSTRAINT "transportations_consignee_contractor_id_fkey";

-- DropForeignKey
ALTER TABLE "transportations" DROP CONSTRAINT "transportations_shipper_contractor_id_fkey";

-- DropIndex
DROP INDEX "transportation_legs_carrier_id_idx";

-- DropIndex
DROP INDEX "transportation_legs_transportation_id_sequence_key";

-- DropIndex
DROP INDEX "transportation_status_events_transportation_id_changed_at_idx";

-- AlterTable
ALTER TABLE "transportation_legs" DROP COLUMN "carrier_id",
DROP COLUMN "created_at",
DROP COLUMN "destination_point",
DROP COLUMN "driver_license_issue_date",
DROP COLUMN "driver_license_issued_by",
DROP COLUMN "origin_point",
DROP COLUMN "pickup_event_date",
DROP COLUMN "planned_delivery_date",
DROP COLUMN "planned_pickup_date",
DROP COLUMN "sequence",
DROP COLUMN "subcontractor_currency",
DROP COLUMN "trailer_number",
DROP COLUMN "transport_mode",
DROP COLUMN "unloading_event_date",
DROP COLUMN "updated_at",
ADD COLUMN     "actual_end_date" DATE,
ADD COLUMN     "actual_start_date" DATE,
ADD COLUMN     "driver_license_date" DATE,
ADD COLUMN     "driver_license_issuer" TEXT,
ADD COLUMN     "from_point" TEXT NOT NULL,
ADD COLUMN     "mode" "LegTransportMode" NOT NULL,
ADD COLUMN     "order_index" INTEGER NOT NULL,
ADD COLUMN     "planned_end_date" DATE,
ADD COLUMN     "planned_start_date" DATE,
ADD COLUMN     "subcontractor_id" TEXT,
ADD COLUMN     "subcontractor_rate_currency" VARCHAR(3),
ADD COLUMN     "to_point" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transportation_status_events" DROP COLUMN "changed_at",
DROP COLUMN "changed_by_id",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_rollback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "set_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "set_by_id" TEXT NOT NULL,
ALTER COLUMN "event_date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "transportations" DROP COLUMN "accompanying_documents",
DROP COLUMN "cargo_currency",
DROP COLUMN "consignee_contractor_id",
DROP COLUMN "loading_at",
DROP COLUMN "shipper_contractor_id",
DROP COLUMN "vehicle_body_type",
ADD COLUMN     "accompanying_docs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "body_type" TEXT,
ADD COLUMN     "cargo_value_currency" VARCHAR(3),
ADD COLUMN     "loading_date_time" TIMESTAMP(3),
ADD COLUMN     "unloading_event_date" DATE;

-- CreateIndex
CREATE INDEX "transportation_legs_subcontractor_id_idx" ON "transportation_legs"("subcontractor_id");

-- CreateIndex
CREATE UNIQUE INDEX "transportation_legs_transportation_id_order_index_key" ON "transportation_legs"("transportation_id", "order_index");

-- CreateIndex
CREATE INDEX "transportation_status_events_transportation_id_set_at_idx" ON "transportation_status_events"("transportation_id", "set_at");

-- AddForeignKey
ALTER TABLE "transportation_legs" ADD CONSTRAINT "transportation_legs_subcontractor_id_fkey" FOREIGN KEY ("subcontractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportation_status_events" ADD CONSTRAINT "transportation_status_events_set_by_id_fkey" FOREIGN KEY ("set_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
