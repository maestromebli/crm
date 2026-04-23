-- ENVER OS core persistence:
-- 1) Project spec + versions + lines
-- 2) Handoff checklist items
-- 3) Order financial snapshots

DO $$ BEGIN
  CREATE TYPE "ProjectSpecStatus" AS ENUM (
    'DRAFT',
    'UNDER_REVIEW',
    'APPROVED_FOR_CONTRACT',
    'APPROVED_FOR_EXECUTION',
    'SUPERSEDED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectSpecVersionStatus" AS ENUM (
    'DRAFT',
    'REVIEW',
    'APPROVED',
    'REJECTED',
    'SUPERSEDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectSpecApprovalStage" AS ENUM (
    'COMMERCIAL',
    'CLIENT',
    'TECHNICAL',
    'EXECUTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SpecLineType" AS ENUM (
    'PRODUCT',
    'MODULE',
    'PART',
    'MATERIAL',
    'HARDWARE',
    'SERVICE',
    'OPERATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProjectSpec" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "dealId" TEXT,
  "currentVersionId" TEXT,
  "status" "ProjectSpecStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectSpec_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectSpecVersion" (
  "id" TEXT NOT NULL,
  "projectSpecId" TEXT NOT NULL,
  "versionNo" INTEGER NOT NULL,
  "basedOnEstimateId" TEXT,
  "basedOnMeasurementResultId" TEXT,
  "approvalStage" "ProjectSpecApprovalStage" NOT NULL DEFAULT 'COMMERCIAL',
  "status" "ProjectSpecVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "changeReason" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "isExecutionBaseline" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectSpecVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectSpecLine" (
  "id" TEXT NOT NULL,
  "specVersionId" TEXT NOT NULL,
  "parentLineId" TEXT,
  "lineCode" TEXT,
  "lineType" "SpecLineType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "width" DECIMAL(12,3),
  "height" DECIMAL(12,3),
  "depth" DECIMAL(12,3),
  "length" DECIMAL(12,3),
  "area" DECIMAL(12,3),
  "color" TEXT,
  "plannedSaleAmount" DECIMAL(14,2),
  "plannedCostAmount" DECIMAL(14,2),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "attributesJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectSpecLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DealHandoffChecklistItem" (
  "id" TEXT NOT NULL,
  "handoffId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isChecked" BOOLEAN NOT NULL DEFAULT false,
  "checkedById" TEXT,
  "checkedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealHandoffChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderFinancialSnapshot" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "dealId" TEXT,
  "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "plannedRevenue" DECIMAL(18,2) NOT NULL,
  "actualRevenue" DECIMAL(18,2) NOT NULL,
  "plannedCost" DECIMAL(18,2) NOT NULL,
  "actualCost" DECIMAL(18,2) NOT NULL,
  "plannedMargin" DECIMAL(9,4),
  "actualMargin" DECIMAL(9,4),
  "source" TEXT NOT NULL DEFAULT 'system',
  "comment" TEXT,
  "metaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderFinancialSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectSpec_orderId_key" ON "ProjectSpec"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectSpec_currentVersionId_key" ON "ProjectSpec"("currentVersionId");
CREATE INDEX IF NOT EXISTS "ProjectSpec_dealId_idx" ON "ProjectSpec"("dealId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectSpecVersion_projectSpecId_versionNo_key" ON "ProjectSpecVersion"("projectSpecId", "versionNo");
CREATE INDEX IF NOT EXISTS "ProjectSpecVersion_projectSpecId_status_idx" ON "ProjectSpecVersion"("projectSpecId", "status");
CREATE INDEX IF NOT EXISTS "ProjectSpecLine_specVersionId_sortOrder_idx" ON "ProjectSpecLine"("specVersionId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ProjectSpecLine_parentLineId_idx" ON "ProjectSpecLine"("parentLineId");
CREATE INDEX IF NOT EXISTS "DealHandoffChecklistItem_handoffId_isRequired_isChecked_idx" ON "DealHandoffChecklistItem"("handoffId", "isRequired", "isChecked");
CREATE INDEX IF NOT EXISTS "OrderFinancialSnapshot_orderId_snapshotDate_idx" ON "OrderFinancialSnapshot"("orderId", "snapshotDate");
CREATE INDEX IF NOT EXISTS "OrderFinancialSnapshot_dealId_snapshotDate_idx" ON "OrderFinancialSnapshot"("dealId", "snapshotDate");

DO $$ BEGIN
  ALTER TABLE "ProjectSpec"
    ADD CONSTRAINT "ProjectSpec_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectSpec"
    ADD CONSTRAINT "ProjectSpec_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectSpecVersion"
    ADD CONSTRAINT "ProjectSpecVersion_projectSpecId_fkey" FOREIGN KEY ("projectSpecId") REFERENCES "ProjectSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectSpecVersion"
    ADD CONSTRAINT "ProjectSpecVersion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectSpecVersion"
    ADD CONSTRAINT "ProjectSpecVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectSpec"
    ADD CONSTRAINT "ProjectSpec_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ProjectSpecVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectSpecLine"
    ADD CONSTRAINT "ProjectSpecLine_specVersionId_fkey" FOREIGN KEY ("specVersionId") REFERENCES "ProjectSpecVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectSpecLine"
    ADD CONSTRAINT "ProjectSpecLine_parentLineId_fkey" FOREIGN KEY ("parentLineId") REFERENCES "ProjectSpecLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealHandoffChecklistItem"
    ADD CONSTRAINT "DealHandoffChecklistItem_handoffId_fkey" FOREIGN KEY ("handoffId") REFERENCES "DealHandoff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealHandoffChecklistItem"
    ADD CONSTRAINT "DealHandoffChecklistItem_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderFinancialSnapshot"
    ADD CONSTRAINT "OrderFinancialSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderFinancialSnapshot"
    ADD CONSTRAINT "OrderFinancialSnapshot_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
