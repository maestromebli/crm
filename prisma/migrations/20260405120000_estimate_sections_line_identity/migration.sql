-- Фаза 1: секції смети, стабільний id рядка для дифів, коди та нотатки.
-- Нові значення enum (додаються в кінець типу PostgreSQL).
ALTER TYPE "EstimateLineType" ADD VALUE 'MATERIAL';
ALTER TYPE "EstimateLineType" ADD VALUE 'FITTING';
ALTER TYPE "EstimateLineType" ADD VALUE 'WORK';

CREATE TABLE "EstimateSection" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" VARCHAR(200) NOT NULL,
    "key" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EstimateSection_estimateId_sortOrder_idx" ON "EstimateSection"("estimateId", "sortOrder");

ALTER TABLE "EstimateSection" ADD CONSTRAINT "EstimateSection_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EstimateLineItem" ADD COLUMN "sectionId" TEXT;
ALTER TABLE "EstimateLineItem" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EstimateLineItem" ADD COLUMN "stableLineId" TEXT;
ALTER TABLE "EstimateLineItem" ADD COLUMN "code" VARCHAR(128);
ALTER TABLE "EstimateLineItem" ADD COLUMN "supplierRef" VARCHAR(512);
ALTER TABLE "EstimateLineItem" ADD COLUMN "notes" TEXT;

UPDATE "EstimateLineItem" SET "stableLineId" = "id" WHERE "stableLineId" IS NULL;

ALTER TABLE "EstimateLineItem" ALTER COLUMN "stableLineId" SET NOT NULL;

ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "EstimateSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "EstimateLineItem_sectionId_sortOrder_idx" ON "EstimateLineItem"("sectionId", "sortOrder");
CREATE INDEX "EstimateLineItem_stableLineId_idx" ON "EstimateLineItem"("stableLineId");
