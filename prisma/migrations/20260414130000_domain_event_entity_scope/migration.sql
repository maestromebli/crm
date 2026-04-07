-- DomainEvent: universal entity scope for dynamic layer timeline
ALTER TABLE "DomainEvent"
  ADD COLUMN IF NOT EXISTS "entityType" TEXT,
  ADD COLUMN IF NOT EXISTS "entityId" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "DomainEvent_entityType_entityId_createdAt_idx"
  ON "DomainEvent"("entityType", "entityId", "createdAt");

CREATE INDEX IF NOT EXISTS "DomainEvent_userId_createdAt_idx"
  ON "DomainEvent"("userId", "createdAt");
