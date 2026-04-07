-- Дії фінансового модуля в ActivityLog (експорт CSV, синхронізація банку).
ALTER TYPE "ActivityEntityType" ADD VALUE 'FINANCE';
ALTER TYPE "ActivityType" ADD VALUE 'FINANCE_CSV_EXPORTED';
ALTER TYPE "ActivityType" ADD VALUE 'BANK_SYNC_REQUESTED';
