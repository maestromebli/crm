-- SaaS foundation: Workspace / WorkspaceMember + canonical enums (LeadStage, DealStage, …)
-- Idempotent-friendly: enums use IF NOT EXISTS where supported; tables use standard CREATE.

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM (
  'NEW',
  'CONTACTED',
  'MEASUREMENT_SCHEDULED',
  'MEASUREMENT_DONE',
  'CALCULATION',
  'QUOTE_DRAFT',
  'QUOTE_SENT',
  'APPROVED',
  'CONVERTED',
  'LOST'
);

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM (
  'NEW_DEAL',
  'CONTROL_MEASUREMENT',
  'CONTRACT_PREPARATION',
  'CONTRACT_SIGNED',
  'AWAITING_PREPAYMENT',
  'IN_PRODUCTION_PREPARATION',
  'IN_PRODUCTION',
  'COMPLETED',
  'CLOSED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "StandardEventType" AS ENUM (
  'MEETING',
  'MEASUREMENT',
  'CONTROL_MEASUREMENT',
  'FOLLOW_UP',
  'CALL',
  'INTERNAL'
);

-- CreateEnum
CREATE TYPE "CrmFileCategory" AS ENUM (
  'PROJECT',
  'PHOTO',
  'MEASUREMENT',
  'ESTIMATE',
  'QUOTE',
  'CONTRACT',
  'SPECIFICATION',
  'INVOICE',
  'PAYMENT',
  'TECHNICAL',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "CrmMessageChannel" AS ENUM (
  'TELEGRAM',
  'INSTAGRAM',
  'EMAIL',
  'PHONE',
  'INTERNAL_NOTE',
  'WHATSAPP'
);

-- CreateEnum
CREATE TYPE "ClientPaymentStatus" AS ENUM (
  'PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_slug_idx" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
