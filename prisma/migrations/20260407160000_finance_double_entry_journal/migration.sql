-- Подвійний запис: план рахунків + журнал проводок.

DO $enum$
BEGIN
  ALTER TYPE "ActivityType" ADD VALUE 'FINANCE_JOURNAL_POSTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$enum$;

CREATE TYPE "LedgerAccountKind" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "FinanceJournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LedgerAccountKind" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount"("code");

CREATE TABLE "FinanceJournalEntry" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "status" "FinanceJournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "memo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinanceJournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceJournalEntry_dealId_idx" ON "FinanceJournalEntry"("dealId");
CREATE INDEX "FinanceJournalEntry_postedAt_idx" ON "FinanceJournalEntry"("postedAt");
CREATE INDEX "FinanceJournalEntry_status_idx" ON "FinanceJournalEntry"("status");

CREATE TABLE "FinanceJournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "debitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineMemo" VARCHAR(512),
    CONSTRAINT "FinanceJournalLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceJournalLine_entryId_idx" ON "FinanceJournalLine"("entryId");
CREATE INDEX "FinanceJournalLine_ledgerAccountId_idx" ON "FinanceJournalLine"("ledgerAccountId");

ALTER TABLE "FinanceJournalEntry" ADD CONSTRAINT "FinanceJournalEntry_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceJournalEntry" ADD CONSTRAINT "FinanceJournalEntry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceJournalLine" ADD CONSTRAINT "FinanceJournalLine_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceJournalLine" ADD CONSTRAINT "FinanceJournalLine_ledgerAccountId_fkey"
  FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "LedgerAccount" ("id", "code", "name", "kind", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT 'la_seed_301', '301', 'Каса в національній валюті', 'ASSET'::"LedgerAccountKind", true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "code" = '301');

INSERT INTO "LedgerAccount" ("id", "code", "name", "kind", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT 'la_seed_311', '311', 'Поточні рахунки в банку', 'ASSET'::"LedgerAccountKind", true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "code" = '311');

INSERT INTO "LedgerAccount" ("id", "code", "name", "kind", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT 'la_seed_361', '361', 'Розрахунки з покупцями та замовниками', 'ASSET'::"LedgerAccountKind", true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "code" = '361');

INSERT INTO "LedgerAccount" ("id", "code", "name", "kind", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT 'la_seed_631', '631', 'Розрахунки з постачальниками та підрядниками', 'LIABILITY'::"LedgerAccountKind", true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "code" = '631');

INSERT INTO "LedgerAccount" ("id", "code", "name", "kind", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT 'la_seed_702', '702', 'Дохід від реалізації продукції (товарів, робіт, послуг)', 'REVENUE'::"LedgerAccountKind", true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "code" = '702');

INSERT INTO "LedgerAccount" ("id", "code", "name", "kind", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT 'la_seed_92', '92', 'Адміністративні витрати', 'EXPENSE'::"LedgerAccountKind", true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "code" = '92');
