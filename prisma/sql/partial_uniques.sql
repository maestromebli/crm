-- Run after Prisma migrate / db push (adjust quoted identifiers if you use @@map).
-- PostgreSQL: plain UNIQUE(category, pipeline_id) allows duplicate (category, NULL).
-- These partial indexes enforce the intended invariants.

-- One global policy row per category (pipeline_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "AttachmentCategoryPolicy_category_global_key"
  ON "AttachmentCategoryPolicy" ("category")
  WHERE "pipelineId" IS NULL;

-- One row per (category, pipeline) when scoped to a pipeline
CREATE UNIQUE INDEX IF NOT EXISTS "AttachmentCategoryPolicy_category_pipeline_key"
  ON "AttachmentCategoryPolicy" ("category", "pipelineId")
  WHERE "pipelineId" IS NOT NULL;

-- ReadinessRule: one row per (ruleSetId, ruleKey) when stage is unspecified (applies to all stages)
CREATE UNIQUE INDEX IF NOT EXISTS "ReadinessRule_ruleSet_ruleKey_global_stage_key"
  ON "ReadinessRule" ("ruleSetId", "ruleKey")
  WHERE "stageId" IS NULL;

-- ReadinessRule: one row per (ruleSetId, ruleKey, stageId) when stage is set
CREATE UNIQUE INDEX IF NOT EXISTS "ReadinessRule_ruleSet_ruleKey_stage_key"
  ON "ReadinessRule" ("ruleSetId", "ruleKey", "stageId")
  WHERE "stageId" IS NOT NULL;

-- ReadinessOverride: at most one APPROVED row per (dealId, ruleKey) should be enforced in the service layer
-- (partial unique on status = APPROVED is possible; expiry requires periodic job or check constraint — not shown here).

-- FileAsset: at most one current Attachment per FileAsset (legacy rows with null fileAssetId excluded)
CREATE UNIQUE INDEX IF NOT EXISTS "Attachment_one_current_per_file_asset"
  ON "Attachment" ("fileAssetId")
  WHERE "fileAssetId" IS NOT NULL AND "isCurrentVersion" = true AND "deletedAt" IS NULL;
