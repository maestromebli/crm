-- Рахунки на оплату, вхідні платежі, алокації, знімки P&L по угоді; dealId у FinanceTransaction.
CREATE TYPE "FinanceInvoiceType" AS ENUM ('PREPAYMENT', 'FINAL', 'CUSTOM');
CREATE TYPE "FinanceInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE "ClientPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD');

ALTER TYPE "ActivityType" ADD VALUE 'FINANCE_INVOICE_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'FINANCE_INVOICE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'CLIENT_PAYMENT_RECORDED';
ALTER TYPE "ActivityType" ADD VALUE 'CLIENT_PAYMENT_VOIDED';
ALTER TYPE "ActivityType" ADD VALUE 'DEAL_FINANCE_SNAPSHOT_SAVED';

ALTER TABLE "FinanceTransaction" ADD COLUMN IF NOT EXISTS "dealId" TEXT;
CREATE INDEX IF NOT EXISTS "FinanceTransaction_dealId_idx" ON "FinanceTransaction"("dealId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FinanceTransaction_dealId_fkey'
  ) THEN
    ALTER TABLE "FinanceTransaction"
      ADD CONSTRAINT "FinanceTransaction_dealId_fkey"
      FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FinanceInvoice" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "FinanceInvoiceType" NOT NULL,
    "status" "FinanceInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UAH',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "documentNumber" VARCHAR(64),
    "dealPaymentMilestoneId" TEXT,
    "projectPaymentPlanId" TEXT,
    "pdfPayloadJson" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinanceInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FinanceInvoice_dealId_idx" ON "FinanceInvoice"("dealId");
CREATE INDEX IF NOT EXISTS "FinanceInvoice_projectId_idx" ON "FinanceInvoice"("projectId");
CREATE INDEX IF NOT EXISTS "FinanceInvoice_status_idx" ON "FinanceInvoice"("status");
CREATE INDEX IF NOT EXISTS "FinanceInvoice_dueDate_idx" ON "FinanceInvoice"("dueDate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceInvoice_dealId_fkey') THEN
    ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_dealId_fkey"
      FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceInvoice_projectId_fkey') THEN
    ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceInvoice_dealPaymentMilestoneId_fkey') THEN
    ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_dealPaymentMilestoneId_fkey"
      FOREIGN KEY ("dealPaymentMilestoneId") REFERENCES "DealPaymentMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceInvoice_projectPaymentPlanId_fkey') THEN
    ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_projectPaymentPlanId_fkey"
      FOREIGN KEY ("projectPaymentPlanId") REFERENCES "ProjectPaymentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceInvoice_createdById_fkey') THEN
    ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "IncomingPayment" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "projectId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UAH',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "ClientPaymentMethod" NOT NULL,
    "proofAttachmentId" TEXT,
    "comment" TEXT,
    "recordedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomingPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IncomingPayment_dealId_idx" ON "IncomingPayment"("dealId");
CREATE INDEX IF NOT EXISTS "IncomingPayment_projectId_idx" ON "IncomingPayment"("projectId");
CREATE INDEX IF NOT EXISTS "IncomingPayment_paidAt_idx" ON "IncomingPayment"("paidAt");
CREATE INDEX IF NOT EXISTS "IncomingPayment_voidedAt_idx" ON "IncomingPayment"("voidedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IncomingPayment_dealId_fkey') THEN
    ALTER TABLE "IncomingPayment" ADD CONSTRAINT "IncomingPayment_dealId_fkey"
      FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IncomingPayment_projectId_fkey') THEN
    ALTER TABLE "IncomingPayment" ADD CONSTRAINT "IncomingPayment_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IncomingPayment_proofAttachmentId_fkey') THEN
    ALTER TABLE "IncomingPayment" ADD CONSTRAINT "IncomingPayment_proofAttachmentId_fkey"
      FOREIGN KEY ("proofAttachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IncomingPayment_recordedById_fkey') THEN
    ALTER TABLE "IncomingPayment" ADD CONSTRAINT "IncomingPayment_recordedById_fkey"
      FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "incomingPaymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAllocation_incomingPaymentId_invoiceId_key"
  ON "PaymentAllocation"("incomingPaymentId", "invoiceId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_incomingPaymentId_fkey') THEN
    ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_incomingPaymentId_fkey"
      FOREIGN KEY ("incomingPaymentId") REFERENCES "IncomingPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_invoiceId_fkey') THEN
    ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DealFinanceSnapshot" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revenueUah" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expensesUah" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profitUah" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "marginPct" DECIMAL(8,4),
    "source" VARCHAR(32) NOT NULL DEFAULT 'rollup',
    "metaJson" JSONB,
    CONSTRAINT "DealFinanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DealFinanceSnapshot_dealId_capturedAt_idx" ON "DealFinanceSnapshot"("dealId", "capturedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DealFinanceSnapshot_dealId_fkey') THEN
    ALTER TABLE "DealFinanceSnapshot" ADD CONSTRAINT "DealFinanceSnapshot_dealId_fkey"
      FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
