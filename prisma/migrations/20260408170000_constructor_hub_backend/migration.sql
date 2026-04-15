-- Constructor Hub backend/domain foundation
-- Manual migration (generated due shadow-db migration history issue in local environment)

-- 1) Extend ActivityType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_WORKSPACE_CREATED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_WORKSPACE_CREATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_ASSIGNED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_ASSIGNED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_TECHSPEC_UPDATED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_TECHSPEC_UPDATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_QUESTION_CREATED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_QUESTION_CREATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_QUESTION_ANSWERED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_QUESTION_ANSWERED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_QUESTION_CLOSED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_QUESTION_CLOSED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_FILE_UPLOADED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_FILE_UPLOADED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_VERSION_CREATED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_VERSION_CREATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_VERSION_SUBMITTED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_VERSION_SUBMITTED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_REVIEW_APPROVED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_REVIEW_APPROVED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_REVIEW_RETURNED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_REVIEW_RETURNED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONSTRUCTOR_HANDOFF_COMPLETED' AND enumtypid = '"ActivityType"'::regtype) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'CONSTRUCTOR_HANDOFF_COMPLETED';
  END IF;
END $$;

-- 2) New enums
CREATE TYPE "ConstructorWorkspaceStatus" AS ENUM (
  'NOT_ASSIGNED','ASSIGNED','REVIEWING_INPUT','QUESTIONS_OPEN','IN_PROGRESS','DRAFT_UPLOADED','UNDER_REVIEW','REVISION_REQUESTED','APPROVED','HANDED_OFF_TO_PRODUCTION','CANCELLED'
);
CREATE TYPE "ConstructorQuestionCategory" AS ENUM (
  'DIMENSIONS','MATERIALS','FITTINGS','APPLIANCES','INSTALLATION','DESIGN','PRODUCTION','OTHER'
);
CREATE TYPE "ConstructorQuestionPriority" AS ENUM (
  'LOW','MEDIUM','HIGH','CRITICAL'
);
CREATE TYPE "ConstructorQuestionStatus" AS ENUM (
  'OPEN','IN_PROGRESS','ANSWERED','CLOSED'
);
CREATE TYPE "ConstructorFileCategory" AS ENUM (
  'CLIENT_PROJECT','OBJECT_PHOTO','MEASUREMENT','VIDEO','REFERENCE','APPROVED_QUOTE','APPROVED_MATERIALS','REVISION_COMMENT','CONSTRUCTOR_DRAFT','CONSTRUCTOR_FINAL','SPECIFICATION','FITTINGS_LIST','MATERIALS_LIST','CNC_FILE','DRAWING','ASSEMBLY_SCHEME','PRODUCTION_PACKAGE','ARCHIVE','OTHER'
);
CREATE TYPE "ConstructorVersionType" AS ENUM ('DRAFT','REVIEW','FINAL');
CREATE TYPE "ConstructorVersionStatus" AS ENUM ('PREPARING','SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','APPROVED','REJECTED');
CREATE TYPE "ConstructorReviewDecision" AS ENUM ('APPROVE','RETURN_FOR_REVISION','COMMENT_ONLY');
CREATE TYPE "ConstructorReviewSeverity" AS ENUM ('INFO','MINOR','MAJOR','CRITICAL');
CREATE TYPE "ConstructorZoneStatus" AS ENUM ('NOT_STARTED','IN_PROGRESS','BLOCKED','READY','APPROVED');
CREATE TYPE "ConstructorAIInsightType" AS ENUM ('MISMATCH','MISSING_DATA','OPEN_QUESTION','WARNING','RECOMMENDATION');
CREATE TYPE "ConstructorAIInsightSeverity" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');

-- 3) Tables
CREATE TABLE "ConstructorWorkspace" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "productionFlowId" TEXT,
  "productionOrderId" TEXT,
  "assignedConstructorUserId" TEXT,
  "assignedByUserId" TEXT,
  "status" "ConstructorWorkspaceStatus" NOT NULL DEFAULT 'NOT_ASSIGNED',
  "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "dueDate" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "handedOffAt" TIMESTAMP(3),
  "snapshotOutdated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstructorWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructorTechSpec" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "generalInfoJson" JSONB,
  "zonesJson" JSONB,
  "modulesJson" JSONB,
  "materialsJson" JSONB,
  "facadesJson" JSONB,
  "fittingsJson" JSONB,
  "lightingAndAppliancesJson" JSONB,
  "installationNotesJson" JSONB,
  "risksJson" JSONB,
  "requiredAttentionJson" JSONB,
  "sourceSnapshotJson" JSONB,
  "approvedDataSnapshotJson" JSONB,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstructorTechSpec_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructorQuestion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "assignedToUserId" TEXT,
  "assignedRole" TEXT,
  "category" "ConstructorQuestionCategory" NOT NULL DEFAULT 'OTHER',
  "priority" "ConstructorQuestionPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "ConstructorQuestionStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "answerText" TEXT,
  "answeredByUserId" TEXT,
  "answeredAt" TIMESTAMP(3),
  "isCritical" BOOLEAN NOT NULL DEFAULT false,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "ConstructorQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructorVersion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "versionCode" TEXT NOT NULL,
  "type" "ConstructorVersionType" NOT NULL DEFAULT 'DRAFT',
  "status" "ConstructorVersionStatus" NOT NULL DEFAULT 'PREPARING',
  "summary" TEXT NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "submittedByUserId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "returnReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstructorVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructorFile" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "versionId" TEXT,
  "uploadedByUserId" TEXT,
  "fileStorageKey" TEXT,
  "fileUrl" TEXT,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "sizeBytes" INTEGER,
  "fileCategory" "ConstructorFileCategory" NOT NULL DEFAULT 'OTHER',
  "versionLabel" TEXT,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "isImportant" BOOLEAN NOT NULL DEFAULT false,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstructorFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructorReview" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "decision" "ConstructorReviewDecision" NOT NULL,
  "comment" TEXT,
  "severity" "ConstructorReviewSeverity" NOT NULL DEFAULT 'INFO',
  "checklistJson" JSONB,
  "remarksJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstructorReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructorChecklistItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "completedByUserId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstructorChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructorZoneProgress" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "zoneKey" TEXT NOT NULL,
  "zoneTitle" TEXT NOT NULL,
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "status" "ConstructorZoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstructorZoneProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructorAIInsight" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "versionId" TEXT,
  "type" "ConstructorAIInsightType" NOT NULL,
  "severity" "ConstructorAIInsightSeverity" NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sourceRefJson" JSONB,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstructorAIInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructorTimelineEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConstructorTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- 4) Unique/indexes
CREATE UNIQUE INDEX "ConstructorWorkspace_dealId_key" ON "ConstructorWorkspace"("dealId");
CREATE UNIQUE INDEX "ConstructorWorkspace_productionFlowId_key" ON "ConstructorWorkspace"("productionFlowId");
CREATE INDEX "ConstructorWorkspace_status_dueDate_idx" ON "ConstructorWorkspace"("status", "dueDate");
CREATE INDEX "ConstructorWorkspace_assignedConstructorUserId_status_idx" ON "ConstructorWorkspace"("assignedConstructorUserId", "status");

CREATE UNIQUE INDEX "ConstructorTechSpec_workspaceId_key" ON "ConstructorTechSpec"("workspaceId");
CREATE INDEX "ConstructorQuestion_workspaceId_status_idx" ON "ConstructorQuestion"("workspaceId", "status");
CREATE INDEX "ConstructorQuestion_assignedToUserId_status_idx" ON "ConstructorQuestion"("assignedToUserId", "status");
CREATE UNIQUE INDEX "ConstructorVersion_workspaceId_versionNumber_key" ON "ConstructorVersion"("workspaceId", "versionNumber");
CREATE INDEX "ConstructorVersion_workspaceId_status_idx" ON "ConstructorVersion"("workspaceId", "status");
CREATE INDEX "ConstructorFile_workspaceId_fileCategory_idx" ON "ConstructorFile"("workspaceId", "fileCategory");
CREATE INDEX "ConstructorFile_versionId_idx" ON "ConstructorFile"("versionId");
CREATE INDEX "ConstructorReview_workspaceId_createdAt_idx" ON "ConstructorReview"("workspaceId", "createdAt");
CREATE INDEX "ConstructorReview_versionId_idx" ON "ConstructorReview"("versionId");
CREATE UNIQUE INDEX "ConstructorChecklistItem_workspaceId_code_key" ON "ConstructorChecklistItem"("workspaceId", "code");
CREATE INDEX "ConstructorChecklistItem_workspaceId_isCompleted_idx" ON "ConstructorChecklistItem"("workspaceId", "isCompleted");
CREATE UNIQUE INDEX "ConstructorZoneProgress_workspaceId_zoneKey_key" ON "ConstructorZoneProgress"("workspaceId", "zoneKey");
CREATE INDEX "ConstructorZoneProgress_workspaceId_status_idx" ON "ConstructorZoneProgress"("workspaceId", "status");
CREATE INDEX "ConstructorAIInsight_workspaceId_createdAt_idx" ON "ConstructorAIInsight"("workspaceId", "createdAt");
CREATE INDEX "ConstructorTimelineEvent_workspaceId_createdAt_idx" ON "ConstructorTimelineEvent"("workspaceId", "createdAt");

-- 5) FKs
ALTER TABLE "ConstructorWorkspace"
  ADD CONSTRAINT "ConstructorWorkspace_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorWorkspace"
  ADD CONSTRAINT "ConstructorWorkspace_productionFlowId_fkey" FOREIGN KEY ("productionFlowId") REFERENCES "ProductionFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructorWorkspace"
  ADD CONSTRAINT "ConstructorWorkspace_assignedConstructorUserId_fkey" FOREIGN KEY ("assignedConstructorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructorWorkspace"
  ADD CONSTRAINT "ConstructorWorkspace_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructorTechSpec"
  ADD CONSTRAINT "ConstructorTechSpec_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ConstructorWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorTechSpec"
  ADD CONSTRAINT "ConstructorTechSpec_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructorTechSpec"
  ADD CONSTRAINT "ConstructorTechSpec_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructorQuestion"
  ADD CONSTRAINT "ConstructorQuestion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ConstructorWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorQuestion"
  ADD CONSTRAINT "ConstructorQuestion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructorQuestion"
  ADD CONSTRAINT "ConstructorQuestion_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructorQuestion"
  ADD CONSTRAINT "ConstructorQuestion_answeredByUserId_fkey" FOREIGN KEY ("answeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructorVersion"
  ADD CONSTRAINT "ConstructorVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ConstructorWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorVersion"
  ADD CONSTRAINT "ConstructorVersion_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructorVersion"
  ADD CONSTRAINT "ConstructorVersion_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructorFile"
  ADD CONSTRAINT "ConstructorFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ConstructorWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorFile"
  ADD CONSTRAINT "ConstructorFile_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ConstructorVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructorFile"
  ADD CONSTRAINT "ConstructorFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructorReview"
  ADD CONSTRAINT "ConstructorReview_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ConstructorWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorReview"
  ADD CONSTRAINT "ConstructorReview_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ConstructorVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorReview"
  ADD CONSTRAINT "ConstructorReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructorChecklistItem"
  ADD CONSTRAINT "ConstructorChecklistItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ConstructorWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorChecklistItem"
  ADD CONSTRAINT "ConstructorChecklistItem_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructorZoneProgress"
  ADD CONSTRAINT "ConstructorZoneProgress_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ConstructorWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConstructorAIInsight"
  ADD CONSTRAINT "ConstructorAIInsight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ConstructorWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorAIInsight"
  ADD CONSTRAINT "ConstructorAIInsight_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ConstructorVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructorTimelineEvent"
  ADD CONSTRAINT "ConstructorTimelineEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ConstructorWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructorTimelineEvent"
  ADD CONSTRAINT "ConstructorTimelineEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
