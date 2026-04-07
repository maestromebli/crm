-- CreateEnum
CREATE TYPE "AiFileProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED_NO_LOCAL_FILE', 'SKIPPED_NO_AI_KEY');

-- CreateEnum
CREATE TYPE "AiDetectedFileCategory" AS ENUM ('PROJECT', 'PHOTO', 'DIMENSIONS', 'MEASUREMENT', 'COMMERCIAL_PROPOSAL', 'CONTRACT', 'INVOICE', 'TECHNICAL', 'VISUALIZATION', 'MESSENGER_SCREENSHOT', 'OTHER');

-- CreateTable
CREATE TABLE "FileAiExtraction" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "entityType" "AttachmentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "detectedCategory" "AiDetectedFileCategory",
    "userConfirmedCategory" "AiDetectedFileCategory",
    "mimeType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "extractedText" TEXT,
    "shortSummary" VARCHAR(2000),
    "detailedSummary" TEXT,
    "extractedEntities" JSONB,
    "extractedMeasurements" JSONB,
    "extractedAmounts" JSONB,
    "extractedDates" JSONB,
    "extractedPeople" JSONB,
    "extractedMaterials" JSONB,
    "extractedRisks" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "processingStatus" "AiFileProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAiExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAssistantLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "model" TEXT,
    "tokensApprox" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAssistantLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileAiExtraction_attachmentId_key" ON "FileAiExtraction"("attachmentId");

-- CreateIndex
CREATE INDEX "FileAiExtraction_entityType_entityId_idx" ON "FileAiExtraction"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FileAiExtraction_processingStatus_idx" ON "FileAiExtraction"("processingStatus");

-- CreateIndex
CREATE INDEX "AiAssistantLog_userId_createdAt_idx" ON "AiAssistantLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantLog_action_createdAt_idx" ON "AiAssistantLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "FileAiExtraction" ADD CONSTRAINT "FileAiExtraction_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAssistantLog" ADD CONSTRAINT "AiAssistantLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
