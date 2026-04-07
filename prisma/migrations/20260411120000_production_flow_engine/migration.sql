-- Production command center: ProductionFlow engine.
-- Some databases had a legacy "ProductionTask" (order/stage) table; the flow engine uses the same model name with flowId — rename legacy first.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ProductionTask' AND column_name = 'orderId'
  ) THEN
    ALTER TABLE "ProductionTask" RENAME TO "ProductionLegacyOrderTask";
    -- Table rename does not rename PK/FK identifiers; free names for the new flow-engine ProductionTask model.
    ALTER TABLE "ProductionLegacyOrderTask" RENAME CONSTRAINT "ProductionTask_pkey" TO "ProductionLegacyOrderTask_pkey";
    ALTER TABLE "ProductionLegacyOrderTask" RENAME CONSTRAINT "ProductionTask_orderId_fkey" TO "ProductionLegacyOrderTask_orderId_fkey";
    ALTER TABLE "ProductionLegacyOrderTask" RENAME CONSTRAINT "ProductionTask_stageId_fkey" TO "ProductionLegacyOrderTask_stageId_fkey";
    ALTER TABLE "ProductionLegacyOrderTask" RENAME CONSTRAINT "ProductionTask_assignedToId_fkey" TO "ProductionLegacyOrderTask_assignedToId_fkey";
  END IF;
END $$;

-- Enums (idempotent if a previous attempt partially applied)
DO $$ BEGIN CREATE TYPE "ProductionFlowStatus" AS ENUM ('NEW', 'ACTIVE', 'ON_HOLD', 'BLOCKED', 'READY_FOR_PROCUREMENT_AND_WORKSHOP', 'IN_WORKSHOP', 'READY_FOR_INSTALLATION', 'DONE', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionStepKey" AS ENUM ('ACCEPTED_BY_CHIEF', 'CONSTRUCTOR_ASSIGNED', 'CONSTRUCTOR_IN_PROGRESS', 'FILES_PACKAGE_UPLOADED', 'FILES_VALIDATED', 'APPROVED_BY_CHIEF', 'TASKS_DISTRIBUTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionStepState" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'DONE', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionTaskType" AS ENUM ('CONSTRUCTOR', 'PROCUREMENT', 'WORKSHOP', 'INSTALLATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionRiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionAIInsightType" AS ENUM ('SUMMARY', 'WARNING', 'NEXT_ACTION', 'RISK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'IGNORED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionConstructorMode" AS ENUM ('INTERNAL', 'OUTSOURCE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProductionFlow" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "productSummary" TEXT,
    "status" "ProductionFlowStatus" NOT NULL DEFAULT 'NEW',
    "currentStepKey" "ProductionStepKey" NOT NULL DEFAULT 'ACCEPTED_BY_CHIEF',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "readinessPercent" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "marginRiskPercent" INTEGER,
    "dueDate" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "distributedAt" TIMESTAMP(3),
    "chiefUserId" TEXT,
    "constructorMode" "ProductionConstructorMode",
    "constructorName" TEXT,
    "constructorCompany" TEXT,
    "constructorWorkspaceUrl" TEXT,
    "telegramThreadUrl" TEXT,
    "procurementTasksCount" INTEGER NOT NULL DEFAULT 0,
    "workshopTasksCount" INTEGER NOT NULL DEFAULT 0,
    "blockersCount" INTEGER NOT NULL DEFAULT 0,
    "openQuestionsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionFlow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionFlowStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "key" "ProductionStepKey" NOT NULL,
    "state" "ProductionStepState" NOT NULL DEFAULT 'LOCKED',
    "sortOrder" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionFlowStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionEvent" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorName" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionTask" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "type" "ProductionTaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductionTaskStatus" NOT NULL DEFAULT 'TODO',
    "assigneeUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionFilePackage" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "packageTypeTags" TEXT[],
    "note" TEXT,
    "uploadedByName" TEXT,
    "validationPassed" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" "ProductionApprovalStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionFilePackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionFileItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileUrl" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionFileItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionApproval" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "packageId" TEXT,
    "status" "ProductionApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "actorName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionRisk" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ProductionRiskSeverity" NOT NULL DEFAULT 'MEDIUM',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionAIInsight" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "type" "ProductionAIInsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ProductionRiskSeverity",
    "recommendedAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionAIInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionQuestion" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "ProductionQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionStationLoad" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stationKey" TEXT NOT NULL,
    "stationLabel" TEXT NOT NULL,
    "loadPercent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionStationLoad_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionFlow_dealId_key" ON "ProductionFlow"("dealId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionFlow_number_key" ON "ProductionFlow"("number");
CREATE INDEX IF NOT EXISTS "ProductionFlow_status_currentStepKey_idx" ON "ProductionFlow"("status", "currentStepKey");
CREATE INDEX IF NOT EXISTS "ProductionFlow_chiefUserId_status_idx" ON "ProductionFlow"("chiefUserId", "status");
CREATE INDEX IF NOT EXISTS "ProductionFlow_dueDate_idx" ON "ProductionFlow"("dueDate");
CREATE INDEX IF NOT EXISTS "ProductionFlow_dealId_idx" ON "ProductionFlow"("dealId");
CREATE INDEX IF NOT EXISTS "ProductionFlowStep_flowId_sortOrder_idx" ON "ProductionFlowStep"("flowId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionFlowStep_flowId_key_key" ON "ProductionFlowStep"("flowId", "key");
CREATE INDEX IF NOT EXISTS "ProductionEvent_flowId_createdAt_idx" ON "ProductionEvent"("flowId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductionTask_flowId_type_status_idx" ON "ProductionTask"("flowId", "type", "status");
CREATE INDEX IF NOT EXISTS "ProductionTask_assigneeUserId_status_idx" ON "ProductionTask"("assigneeUserId", "status");
CREATE INDEX IF NOT EXISTS "ProductionFilePackage_flowId_uploadedAt_idx" ON "ProductionFilePackage"("flowId", "uploadedAt");
CREATE INDEX IF NOT EXISTS "ProductionFileItem_packageId_idx" ON "ProductionFileItem"("packageId");
CREATE INDEX IF NOT EXISTS "ProductionApproval_flowId_createdAt_idx" ON "ProductionApproval"("flowId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductionRisk_flowId_severity_resolvedAt_idx" ON "ProductionRisk"("flowId", "severity", "resolvedAt");
CREATE INDEX IF NOT EXISTS "ProductionAIInsight_flowId_type_createdAt_idx" ON "ProductionAIInsight"("flowId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductionQuestion_flowId_status_isCritical_idx" ON "ProductionQuestion"("flowId", "status", "isCritical");
CREATE INDEX IF NOT EXISTS "ProductionStationLoad_stationKey_loadPercent_idx" ON "ProductionStationLoad"("stationKey", "loadPercent");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionStationLoad_flowId_stationKey_key" ON "ProductionStationLoad"("flowId", "stationKey");

DO $$ BEGIN ALTER TABLE "ProductionFlow" ADD CONSTRAINT "ProductionFlow_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionFlow" ADD CONSTRAINT "ProductionFlow_chiefUserId_fkey" FOREIGN KEY ("chiefUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionFlowStep" ADD CONSTRAINT "ProductionFlowStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProductionFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProductionFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProductionFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionFilePackage" ADD CONSTRAINT "ProductionFilePackage_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProductionFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionFileItem" ADD CONSTRAINT "ProductionFileItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProductionFilePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionApproval" ADD CONSTRAINT "ProductionApproval_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProductionFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionApproval" ADD CONSTRAINT "ProductionApproval_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProductionFilePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionRisk" ADD CONSTRAINT "ProductionRisk_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProductionFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionAIInsight" ADD CONSTRAINT "ProductionAIInsight_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProductionFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionQuestion" ADD CONSTRAINT "ProductionQuestion_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProductionFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductionStationLoad" ADD CONSTRAINT "ProductionStationLoad_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProductionFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
