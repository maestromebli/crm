-- Має виконатися перед 20260404150000 (FK з FinanceInvoice на цю таблицю).
CREATE TABLE IF NOT EXISTS "DealPaymentMilestone" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "dueAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "proofAttachmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DealPaymentMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DealPaymentMilestone_dealId_sortOrder_key"
  ON "DealPaymentMilestone"("dealId", "sortOrder");
CREATE INDEX IF NOT EXISTS "DealPaymentMilestone_dealId_idx" ON "DealPaymentMilestone"("dealId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DealPaymentMilestone_dealId_fkey') THEN
    ALTER TABLE "DealPaymentMilestone" ADD CONSTRAINT "DealPaymentMilestone_dealId_fkey"
      FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DealPaymentMilestone_confirmedById_fkey') THEN
    ALTER TABLE "DealPaymentMilestone" ADD CONSTRAINT "DealPaymentMilestone_confirmedById_fkey"
      FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DealPaymentMilestone_proofAttachmentId_fkey') THEN
    ALTER TABLE "DealPaymentMilestone" ADD CONSTRAINT "DealPaymentMilestone_proofAttachmentId_fkey"
      FOREIGN KEY ("proofAttachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
