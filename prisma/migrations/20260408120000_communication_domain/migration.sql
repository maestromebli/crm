-- Communication domain: threads, messages, AI insights, adapters metadata.
-- Safe to run on DB that already has core CRM tables.

CREATE TYPE "CommEntityType" AS ENUM ('LEAD', 'DEAL', 'CLIENT');
CREATE TYPE "CommChannelType" AS ENUM ('TELEGRAM', 'INSTAGRAM', 'WHATSAPP', 'VIBER', 'SMS', 'EMAIL', 'WEBCHAT', 'INTERNAL_NOTE', 'CALL_LOG', 'OTHER');
CREATE TYPE "CommThreadStatus" AS ENUM ('NEEDS_REPLY', 'WAITING_CLIENT', 'COMPLETED', 'FOLLOW_UP_OVERDUE', 'DORMANT');
CREATE TYPE "CommMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
CREATE TYPE "CommSenderType" AS ENUM ('CLIENT', 'MANAGER', 'INTERNAL', 'BOT', 'SYSTEM');
CREATE TYPE "CommMessageKind" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'VOICE', 'NOTE', 'SYSTEM');
CREATE TYPE "CommDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE "CommTranscriptStatus" AS ENUM ('NONE', 'PENDING', 'READY', 'FAILED');
CREATE TYPE "CommSyncStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'SYNCED', 'ERROR', 'PAUSED');
CREATE TYPE "CommFollowUpStatus" AS ENUM ('OPEN', 'DISMISSED', 'DONE');

CREATE TABLE "CommChannelAccount" (
    "id" TEXT NOT NULL,
    "type" "CommChannelType" NOT NULL,
    "title" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncStatus" "CommSyncStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "healthJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommChannelAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommSyncCheckpoint" (
    "id" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "cursorJson" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommSyncCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommThread" (
    "id" TEXT NOT NULL,
    "entityType" "CommEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "channelType" "CommChannelType" NOT NULL,
    "externalThreadId" TEXT,
    "title" TEXT,
    "participantName" TEXT,
    "participantHandle" TEXT,
    "participantPhone" TEXT,
    "participantAvatarUrl" TEXT,
    "status" "CommThreadStatus" NOT NULL DEFAULT 'WAITING_CLIENT',
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "aiSummaryUpdatedAt" TIMESTAMP(3),
    "needsReply" BOOLEAN NOT NULL DEFAULT false,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "CommSenderType" NOT NULL DEFAULT 'CLIENT',
    "name" TEXT,
    "externalUserId" TEXT,
    "username" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "legacyLeadMessageId" TEXT,
    "externalMessageId" TEXT,
    "direction" "CommMessageDirection" NOT NULL,
    "senderType" "CommSenderType" NOT NULL DEFAULT 'INTERNAL',
    "senderName" TEXT,
    "authorUserId" TEXT,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT,
    "messageKind" "CommMessageKind" NOT NULL DEFAULT 'TEXT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "deliveryStatus" "CommDeliveryStatus",
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "replyToMessageId" TEXT,
    "aiProcessedAt" TIMESTAMP(3),
    "transcriptStatus" "CommTranscriptStatus" NOT NULL DEFAULT 'NONE',
    "transcriptText" TEXT,
    "transcriptError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "attachmentId" TEXT,
    "externalFileId" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "attachmentKind" TEXT NOT NULL DEFAULT 'OTHER',
    "previewUrl" TEXT,
    "extractedText" TEXT,
    "aiSummary" TEXT,
    "detectedCategory" TEXT,
    "transcriptStatus" "CommTranscriptStatus" NOT NULL DEFAULT 'NONE',
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "CommMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommConversationInsight" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "entityType" "CommEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "summaryShort" VARCHAR(2000),
    "summaryDetailed" TEXT,
    "clientIntent" TEXT,
    "extractedNeedsJson" JSONB,
    "extractedMeasurementsJson" JSONB,
    "extractedMaterialsJson" JSONB,
    "extractedBudgetJson" JSONB,
    "extractedDatesJson" JSONB,
    "extractedRisksJson" JSONB,
    "missingInfoJson" JSONB,
    "recommendedNextStep" TEXT,
    "recommendedReply" TEXT,
    "sentiment" TEXT,
    "urgency" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommConversationInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommFollowUpSuggestion" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "entityType" "CommEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "suggestionType" TEXT NOT NULL,
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "draftMessage" TEXT,
    "dueAt" TIMESTAMP(3),
    "urgency" TEXT,
    "status" "CommFollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommFollowUpSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "threadId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommSyncCheckpoint_channelAccountId_scopeKey_key" ON "CommSyncCheckpoint"("channelAccountId", "scopeKey");
CREATE INDEX "CommChannelAccount_type_isActive_idx" ON "CommChannelAccount"("type", "isActive");
CREATE UNIQUE INDEX "CommThread_entityType_entityId_channelType_key" ON "CommThread"("entityType", "entityId", "channelType");
CREATE INDEX "CommThread_entityType_entityId_idx" ON "CommThread"("entityType", "entityId");
CREATE INDEX "CommThread_lastMessageAt_idx" ON "CommThread"("lastMessageAt");
CREATE INDEX "CommParticipant_threadId_idx" ON "CommParticipant"("threadId");
CREATE UNIQUE INDEX "CommMessage_legacyLeadMessageId_key" ON "CommMessage"("legacyLeadMessageId");
CREATE INDEX "CommMessage_threadId_sentAt_idx" ON "CommMessage"("threadId", "sentAt");
CREATE INDEX "CommMessage_externalMessageId_idx" ON "CommMessage"("externalMessageId");
CREATE UNIQUE INDEX "CommMessageAttachment_attachmentId_key" ON "CommMessageAttachment"("attachmentId");
CREATE INDEX "CommMessageAttachment_messageId_idx" ON "CommMessageAttachment"("messageId");
CREATE UNIQUE INDEX "CommConversationInsight_threadId_key" ON "CommConversationInsight"("threadId");
CREATE INDEX "CommConversationInsight_entityType_entityId_idx" ON "CommConversationInsight"("entityType", "entityId");
CREATE INDEX "CommFollowUpSuggestion_threadId_status_idx" ON "CommFollowUpSuggestion"("threadId", "status");
CREATE INDEX "CommFollowUpSuggestion_entityType_entityId_idx" ON "CommFollowUpSuggestion"("entityType", "entityId");
CREATE INDEX "CommAuditLog_userId_createdAt_idx" ON "CommAuditLog"("userId", "createdAt");
CREATE INDEX "CommAuditLog_threadId_idx" ON "CommAuditLog"("threadId");

ALTER TABLE "CommSyncCheckpoint" ADD CONSTRAINT "CommSyncCheckpoint_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "CommChannelAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommParticipant" ADD CONSTRAINT "CommParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommMessage" ADD CONSTRAINT "CommMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommMessage" ADD CONSTRAINT "CommMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommMessageAttachment" ADD CONSTRAINT "CommMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommMessageAttachment" ADD CONSTRAINT "CommMessageAttachment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommConversationInsight" ADD CONSTRAINT "CommConversationInsight_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommFollowUpSuggestion" ADD CONSTRAINT "CommFollowUpSuggestion_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommAuditLog" ADD CONSTRAINT "CommAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
