-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "settingsJson" JSONB;
