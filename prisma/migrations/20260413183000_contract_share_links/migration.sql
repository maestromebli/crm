DO $$ BEGIN
  CREATE TYPE "ContractShareLinkStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ContractShareLink" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "status" "ContractShareLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxViews" INTEGER,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "lastViewedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ContractShareLink_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DealContract"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ContractShareLink_contractId_status_expiresAt_idx"
ON "ContractShareLink"("contractId", "status", "expiresAt");
