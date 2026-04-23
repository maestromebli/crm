-- AlterTable
ALTER TABLE "ProcurementRequest"
  ADD COLUMN "number" TEXT,
  ADD COLUMN "requesterId" TEXT,
  ADD COLUMN "responsibleUserId" TEXT,
  ADD COLUMN "workflowStatus" TEXT NOT NULL DEFAULT 'new_request',
  ADD COLUMN "approvalStatus" TEXT,
  ADD COLUMN "supplierId" TEXT,
  ADD COLUMN "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "plannedTotal" DECIMAL(18,2),
  ADD COLUMN "actualTotal" DECIMAL(18,2),
  ADD COLUMN "currency" TEXT DEFAULT 'UAH',
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "clientOrderId" TEXT,
  ADD COLUMN "comment" TEXT,
  ADD COLUMN "invoiceAttachmentUrl" TEXT,
  ADD COLUMN "invoiceAmount" DECIMAL(18,2),
  ADD COLUMN "paymentDate" TIMESTAMP(3),
  ADD COLUMN "paymentAmount" DECIMAL(18,2),
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "goodsReceivedAt" TIMESTAMP(3),
  ADD COLUMN "accountedAt" TIMESTAMP(3),
  ADD COLUMN "accountingDocumentRef" TEXT;

-- AlterTable
ALTER TABLE "ProcurementItem"
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "itemType" TEXT NOT NULL DEFAULT 'stock',
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "clientOrderId" TEXT,
  ADD COLUMN "reservationStatus" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "warehouseId" TEXT,
  ADD COLUMN "qtyIssued" DOUBLE PRECISION,
  ADD COLUMN "plannedPrice" DECIMAL(18,2),
  ADD COLUMN "actualPrice" DECIMAL(18,2),
  ADD COLUMN "supplierId" TEXT,
  ADD COLUMN "comment" TEXT;

-- CreateTable
CREATE TABLE "ProcurementRequestStatusHistory" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" TEXT,
  "reason" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProcurementRequestStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementRequest_number_key" ON "ProcurementRequest"("number");

-- CreateIndex
CREATE INDEX "ProcurementRequest_workflowStatus_idx" ON "ProcurementRequest"("workflowStatus");

-- CreateIndex
CREATE INDEX "ProcurementRequest_supplierId_idx" ON "ProcurementRequest"("supplierId");

-- CreateIndex
CREATE INDEX "ProcurementItem_itemType_projectId_idx" ON "ProcurementItem"("itemType", "projectId");

-- CreateIndex
CREATE INDEX "ProcurementRequestStatusHistory_requestId_createdAt_idx" ON "ProcurementRequestStatusHistory"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ProcurementRequestStatusHistory_toStatus_idx" ON "ProcurementRequestStatusHistory"("toStatus");

-- AddForeignKey
ALTER TABLE "ProcurementRequest"
  ADD CONSTRAINT "ProcurementRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementRequest"
  ADD CONSTRAINT "ProcurementRequest_responsibleUserId_fkey"
  FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementRequest"
  ADD CONSTRAINT "ProcurementRequest_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementRequestStatusHistory"
  ADD CONSTRAINT "ProcurementRequestStatusHistory_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "ProcurementRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementRequestStatusHistory"
  ADD CONSTRAINT "ProcurementRequestStatusHistory_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
