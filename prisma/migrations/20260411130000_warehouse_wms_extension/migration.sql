-- CreateEnum
CREATE TYPE "WarehouseMovementKind" AS ENUM ('RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'RESERVE', 'UNRESERVE');

-- CreateEnum
CREATE TYPE "WarehouseRefKind" AS ENUM ('PURCHASE_ORDER', 'PRODUCTION_TASK', 'PRODUCTION_FLOW', 'MANUAL', 'DEAL');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateTable
CREATE TABLE "WarehouseStorageZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseStorageZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseStockMovement" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "kind" "WarehouseMovementKind" NOT NULL,
    "quantityDelta" DOUBLE PRECISION NOT NULL,
    "refKind" "WarehouseRefKind",
    "refId" TEXT,
    "note" TEXT,
    "fromZoneId" TEXT,
    "toZoneId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "productionTaskId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStorageZone_barcode_key" ON "WarehouseStorageZone"("barcode");

-- CreateIndex
CREATE INDEX "WarehouseStorageZone_code_idx" ON "WarehouseStorageZone"("code");

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN     "storageZoneId" TEXT;

-- CreateIndex
CREATE INDEX "StockItem_storageZoneId_idx" ON "StockItem"("storageZoneId");

-- CreateIndex
CREATE INDEX "WarehouseStockMovement_stockItemId_createdAt_idx" ON "WarehouseStockMovement"("stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "WarehouseStockMovement_createdAt_idx" ON "WarehouseStockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "WarehouseStockMovement_refKind_refId_idx" ON "WarehouseStockMovement"("refKind", "refId");

-- CreateIndex
CREATE INDEX "StockReservation_stockItemId_status_idx" ON "StockReservation"("stockItemId", "status");

-- CreateIndex
CREATE INDEX "StockReservation_productionTaskId_idx" ON "StockReservation"("productionTaskId");

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_storageZoneId_fkey" FOREIGN KEY ("storageZoneId") REFERENCES "WarehouseStorageZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStockMovement" ADD CONSTRAINT "WarehouseStockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStockMovement" ADD CONSTRAINT "WarehouseStockMovement_fromZoneId_fkey" FOREIGN KEY ("fromZoneId") REFERENCES "WarehouseStorageZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStockMovement" ADD CONSTRAINT "WarehouseStockMovement_toZoneId_fkey" FOREIGN KEY ("toZoneId") REFERENCES "WarehouseStorageZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStockMovement" ADD CONSTRAINT "WarehouseStockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_productionTaskId_fkey" FOREIGN KEY ("productionTaskId") REFERENCES "ProductionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
