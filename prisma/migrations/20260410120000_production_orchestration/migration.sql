-- Production OS: ProductionOrchestration + related tables; Activity / Permission enum extensions.
-- Safe to run if tables/types do not exist yet (fresh deploy). Re-run: guard with manual checks.

-- Enums
CREATE TYPE "ProductionOrchestrationStatus" AS ENUM (
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'CONSTRUCTOR_ASSIGNED',
  'IN_CONSTRUCTOR_WORK',
  'AWAITING_CONSTRUCTOR_REVIEW',
  'CONSTRUCTOR_REVISION_REQUESTED',
  'DESIGN_APPROVED',
  'PROCUREMENT_STARTED',
  'GIBLAB_SENT',
  'IN_PRODUCTION',
  'QC',
  'READY_FOR_INSTALLATION',
  'INSTALLED',
  'CLOSED'
);

CREATE TYPE "ConstructorAssignmentType" AS ENUM ('INTERNAL', 'OUTSOURCED');

CREATE TYPE "ProductionSubflowState" AS ENUM ('NOT_STARTED', 'ACTIVE', 'BLOCKED', 'DONE', 'FAILED');

CREATE TYPE "GiblabExportStatus" AS ENUM (
  'PENDING_EXPORT',
  'EXPORTED',
  'ACCEPTED_BY_GIBLAB',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "ProductionOrchestrationRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "ProductionOpenQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'CONFIRMED', 'IGNORED');

CREATE TYPE "ProductionOpenQuestionSource" AS ENUM ('AI', 'TELEGRAM', 'MANUAL', 'CHAT');

CREATE TYPE "ProductionChangeRequestStatus" AS ENUM ('PROPOSED', 'REVIEWING', 'APPROVED', 'REJECTED', 'IMPLEMENTED');

CREATE TYPE "ProductionInsightKind" AS ENUM (
  'KEY_REQUIREMENT',
  'OPEN_QUESTION',
  'CONTRADICTION',
  'RISK',
  'AI_SUMMARY',
  'ACTION_RECOMMENDATION'
);

CREATE TYPE "HandoffClarificationStatus" AS ENUM ('OPEN', 'RESOLVED');

-- Activity / permissions (append-only enum values)
ALTER TYPE "ActivityEntityType" ADD VALUE 'PRODUCTION_ORCHESTRATION';
-- Порядок значень у PostgreSQL важливий: додаємо після існуючих міток ActivityType.
ALTER TYPE "ActivityType" ADD VALUE 'PRODUCTION_ORCHESTRATION_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'PRODUCTION_ORCHESTRATION_ACCEPTED';
ALTER TYPE "ActivityType" ADD VALUE 'PRODUCTION_ORCHESTRATION_CLARIFICATION_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE 'PRODUCTION_ORCHESTRATION_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE 'PRODUCTION_CONSTRUCTOR_ASSIGNED';
ALTER TYPE "ActivityType" ADD VALUE 'PRODUCTION_DESIGN_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE 'PRODUCTION_DESIGN_REVISION_REQUESTED';

ALTER TYPE "PermissionKey" ADD VALUE 'PRODUCTION_ORCHESTRATION_VIEW';
ALTER TYPE "PermissionKey" ADD VALUE 'PRODUCTION_ORCHESTRATION_MANAGE';

-- Tables
CREATE TABLE "ProductionOrchestration" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "estimateId" TEXT,
    "productionNumber" TEXT NOT NULL,
    "status" "ProductionOrchestrationStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "constructorType" "ConstructorAssignmentType",
    "constructorUserId" TEXT,
    "constructorExternalName" TEXT,
    "constructorExternalPhone" TEXT,
    "constructorExternalEmail" TEXT,
    "externalWorkspaceToken" TEXT,
    "designStatus" "ProductionSubflowState" NOT NULL DEFAULT 'NOT_STARTED',
    "procurementStatus" "ProductionSubflowState" NOT NULL DEFAULT 'NOT_STARTED',
    "giblabStatus" "ProductionSubflowState" NOT NULL DEFAULT 'NOT_STARTED',
    "workshopStatus" "ProductionSubflowState" NOT NULL DEFAULT 'NOT_STARTED',
    "qcStatus" "ProductionSubflowState" NOT NULL DEFAULT 'NOT_STARTED',
    "installationStatus" "ProductionSubflowState" NOT NULL DEFAULT 'NOT_STARTED',
    "giblabExportStatus" "GiblabExportStatus" NOT NULL DEFAULT 'PENDING_EXPORT',
    "giblabExportedAt" TIMESTAMP(3),
    "giblabJobId" TEXT,
    "giblabResponseData" JSONB,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "productionNotes" TEXT,
    "riskLevel" "ProductionOrchestrationRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "telegramChatId" TEXT,
    "telegramGroupTitle" TEXT,
    "aiOperationsSummaryJson" JSONB,
    "approvedDesignPackageVersion" INTEGER,
    "approvedDesignSnapshotJson" JSONB,
    "designLockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrchestration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductionOrchestration_dealId_key" ON "ProductionOrchestration"("dealId");
CREATE UNIQUE INDEX "ProductionOrchestration_productionNumber_key" ON "ProductionOrchestration"("productionNumber");
CREATE UNIQUE INDEX "ProductionOrchestration_externalWorkspaceToken_key" ON "ProductionOrchestration"("externalWorkspaceToken");
CREATE INDEX "ProductionOrchestration_status_dueDate_idx" ON "ProductionOrchestration"("status", "dueDate");
CREATE INDEX "ProductionOrchestration_productionNumber_idx" ON "ProductionOrchestration"("productionNumber");

ALTER TABLE "ProductionOrchestration" ADD CONSTRAINT "ProductionOrchestration_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOrchestration" ADD CONSTRAINT "ProductionOrchestration_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionOrchestration" ADD CONSTRAINT "ProductionOrchestration_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionOrchestration" ADD CONSTRAINT "ProductionOrchestration_constructorUserId_fkey" FOREIGN KEY ("constructorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProductionHandoffClarification" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "issuesJson" JSONB NOT NULL,
    "status" "HandoffClarificationStatus" NOT NULL DEFAULT 'OPEN',
    "messageToManager" TEXT,
    "createdById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionHandoffClarification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionHandoffClarification_dealId_status_idx" ON "ProductionHandoffClarification"("dealId", "status");
ALTER TABLE "ProductionHandoffClarification" ADD CONSTRAINT "ProductionHandoffClarification_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionHandoffClarification" ADD CONSTRAINT "ProductionHandoffClarification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductionOpenQuestion" (
    "id" TEXT NOT NULL,
    "productionOrchestrationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" "ProductionOpenQuestionSource" NOT NULL DEFAULT 'MANUAL',
    "status" "ProductionOpenQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionOpenQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionOpenQuestion_productionOrchestrationId_status_idx" ON "ProductionOpenQuestion"("productionOrchestrationId", "status");
ALTER TABLE "ProductionOpenQuestion" ADD CONSTRAINT "ProductionOpenQuestion_productionOrchestrationId_fkey" FOREIGN KEY ("productionOrchestrationId") REFERENCES "ProductionOrchestration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOpenQuestion" ADD CONSTRAINT "ProductionOpenQuestion_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProductionChangeRequest" (
    "id" TEXT NOT NULL,
    "productionOrchestrationId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedChange" TEXT NOT NULL,
    "impactOnCost" TEXT,
    "impactOnProcurement" TEXT,
    "impactOnTimeline" TEXT,
    "impactOnProduction" TEXT,
    "status" "ProductionChangeRequestStatus" NOT NULL DEFAULT 'PROPOSED',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionChangeRequest_productionOrchestrationId_status_idx" ON "ProductionChangeRequest"("productionOrchestrationId", "status");
ALTER TABLE "ProductionChangeRequest" ADD CONSTRAINT "ProductionChangeRequest_productionOrchestrationId_fkey" FOREIGN KEY ("productionOrchestrationId") REFERENCES "ProductionOrchestration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionChangeRequest" ADD CONSTRAINT "ProductionChangeRequest_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionChangeRequest" ADD CONSTRAINT "ProductionChangeRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProductionCommunicationInsight" (
    "id" TEXT NOT NULL,
    "productionOrchestrationId" TEXT NOT NULL,
    "kind" "ProductionInsightKind" NOT NULL,
    "title" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "severity" "ProductionOrchestrationRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionCommunicationInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionCommunicationInsight_productionOrchestrationId_kind_idx" ON "ProductionCommunicationInsight"("productionOrchestrationId", "kind");
ALTER TABLE "ProductionCommunicationInsight" ADD CONSTRAINT "ProductionCommunicationInsight_productionOrchestrationId_fkey" FOREIGN KEY ("productionOrchestrationId") REFERENCES "ProductionOrchestration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
