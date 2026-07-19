-- CreateEnum
CREATE TYPE "TransportationStatus" AS ENUM ('REQUEST_ACCEPTED', 'CARGO_PICKED', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('AUTO', 'RAIL', 'SEA', 'AIR', 'MULTIMODAL');

-- CreateEnum
CREATE TYPE "LegTransportMode" AS ENUM ('AUTO', 'RAIL', 'SEA', 'AIR', 'BROKER');

-- CreateEnum
CREATE TYPE "VatMode" AS ENUM ('NO_VAT', 'VAT_12');

-- CreateEnum
CREATE TYPE "LegStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "transportations" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "sequence_in_deal" INTEGER NOT NULL,
    "logist_id" TEXT NOT NULL,
    "status" "TransportationStatus" NOT NULL DEFAULT 'REQUEST_ACCEPTED',
    "is_multi_leg" BOOLEAN NOT NULL DEFAULT false,
    "cargo_name" TEXT,
    "places_count" INTEGER,
    "places_unit" TEXT,
    "weight_kg" DECIMAL(14,3),
    "volume_m3" DECIMAL(14,3),
    "cargo_value" DECIMAL(18,2),
    "cargo_currency" VARCHAR(3),
    "is_dangerous" BOOLEAN NOT NULL DEFAULT false,
    "is_temp_controlled" BOOLEAN NOT NULL DEFAULT false,
    "origin_point" TEXT NOT NULL,
    "destination_point" TEXT NOT NULL,
    "transport_mode" "TransportMode" NOT NULL,
    "client_rate" DECIMAL(18,2),
    "client_rate_currency" VARCHAR(3),
    "planned_delivery_date" DATE,
    "pickup_event_date" DATE,
    "actual_delivery_date" DATE,
    "shipper_contractor_id" TEXT,
    "shipper_name" TEXT,
    "consignee_contractor_id" TEXT,
    "consignee_name" TEXT,
    "loading_address" TEXT,
    "loading_at" TIMESTAMP(3),
    "loading_contact_name" TEXT,
    "loading_contact_phone" TEXT,
    "unloading_address" TEXT,
    "unloading_contact_name" TEXT,
    "unloading_contact_phone" TEXT,
    "vehicle_body_type" TEXT,
    "accompanying_documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "special_conditions" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transportations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transportation_legs" (
    "id" TEXT NOT NULL,
    "transportation_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "origin_point" TEXT NOT NULL,
    "destination_point" TEXT NOT NULL,
    "transport_mode" "LegTransportMode" NOT NULL,
    "carrier_id" TEXT,
    "subcontractor_rate" DECIMAL(18,2),
    "subcontractor_currency" VARCHAR(3),
    "vat_mode" "VatMode" NOT NULL DEFAULT 'NO_VAT',
    "planned_pickup_date" DATE,
    "planned_delivery_date" DATE,
    "pickup_event_date" DATE,
    "unloading_event_date" DATE,
    "vehicle_number" TEXT,
    "trailer_number" TEXT,
    "status" "LegStatus" NOT NULL DEFAULT 'WAITING',
    "driver_full_name" TEXT,
    "driver_phone" TEXT,
    "driver_iin" TEXT,
    "driver_license_number" TEXT,
    "driver_license_issue_date" DATE,
    "driver_license_issued_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transportation_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transportation_status_events" (
    "id" TEXT NOT NULL,
    "transportation_id" TEXT NOT NULL,
    "from_status" "TransportationStatus",
    "to_status" "TransportationStatus" NOT NULL,
    "event_date" DATE NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transportation_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transportations_number_key" ON "transportations"("number");

-- CreateIndex
CREATE UNIQUE INDEX "transportations_deal_id_sequence_in_deal_key" ON "transportations"("deal_id", "sequence_in_deal");

-- CreateIndex
CREATE INDEX "transportations_logist_id_idx" ON "transportations"("logist_id");

-- CreateIndex
CREATE INDEX "transportations_status_idx" ON "transportations"("status");

-- CreateIndex
CREATE INDEX "transportation_legs_carrier_id_idx" ON "transportation_legs"("carrier_id");

-- CreateIndex
CREATE UNIQUE INDEX "transportation_legs_transportation_id_sequence_key" ON "transportation_legs"("transportation_id", "sequence");

-- CreateIndex
CREATE INDEX "transportation_status_events_transportation_id_changed_at_idx" ON "transportation_status_events"("transportation_id", "changed_at");

-- AddForeignKey
ALTER TABLE "transportations" ADD CONSTRAINT "transportations_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportations" ADD CONSTRAINT "transportations_logist_id_fkey" FOREIGN KEY ("logist_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportations" ADD CONSTRAINT "transportations_shipper_contractor_id_fkey" FOREIGN KEY ("shipper_contractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportations" ADD CONSTRAINT "transportations_consignee_contractor_id_fkey" FOREIGN KEY ("consignee_contractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportation_legs" ADD CONSTRAINT "transportation_legs_transportation_id_fkey" FOREIGN KEY ("transportation_id") REFERENCES "transportations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportation_legs" ADD CONSTRAINT "transportation_legs_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportation_status_events" ADD CONSTRAINT "transportation_status_events_transportation_id_fkey" FOREIGN KEY ("transportation_id") REFERENCES "transportations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportation_status_events" ADD CONSTRAINT "transportation_status_events_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
