-- Точність грошових сум (DECIMAL) + поля первинки/ПДВ для Invoice.
-- ALTER лише для таблиць, що вже існують у цій БД.

DO $m$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Deal' AND c.relkind = 'r') THEN
    ALTER TABLE "Deal"
      ALTER COLUMN "value" SET DATA TYPE DECIMAL(18,2)
      USING CASE WHEN "value" IS NULL THEN NULL ELSE ROUND(("value")::numeric, 2) END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'MoneyTransaction' AND c.relkind = 'r') THEN
    ALTER TABLE "MoneyTransaction"
      ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("amount")::numeric, 2);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'FinanceTransaction' AND c.relkind = 'r') THEN
    ALTER TABLE "FinanceTransaction"
      ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("amount")::numeric, 2);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'OperatingExpense' AND c.relkind = 'r') THEN
    ALTER TABLE "OperatingExpense"
      ALTER COLUMN "amountActual" SET DATA TYPE DECIMAL(18,2)
      USING CASE WHEN "amountActual" IS NULL THEN NULL ELSE ROUND(("amountActual")::numeric, 2) END;
    ALTER TABLE "OperatingExpense"
      ALTER COLUMN "amountPlanned" SET DATA TYPE DECIMAL(18,2)
      USING CASE WHEN "amountPlanned" IS NULL THEN NULL ELSE ROUND(("amountPlanned")::numeric, 2) END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'PayrollEntry' AND c.relkind = 'r') THEN
    ALTER TABLE "PayrollEntry"
      ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("amount")::numeric, 2);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Commission' AND c.relkind = 'r') THEN
    ALTER TABLE "Commission"
      ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("amount")::numeric, 2);
    ALTER TABLE "Commission"
      ALTER COLUMN "percent" SET DATA TYPE DECIMAL(9,4)
      USING CASE WHEN "percent" IS NULL THEN NULL ELSE ROUND(("percent")::numeric, 4) END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'ProcurementRequestItem' AND c.relkind = 'r') THEN
    ALTER TABLE "ProcurementRequestItem"
      ALTER COLUMN "costPlanned" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("costPlanned")::numeric, 2);
    ALTER TABLE "ProcurementRequestItem"
      ALTER COLUMN "costActual" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("costActual")::numeric, 2);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'ProcurementItem' AND c.relkind = 'r') THEN
    ALTER TABLE "ProcurementItem"
      ALTER COLUMN "costPlanned" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("costPlanned")::numeric, 2);
    ALTER TABLE "ProcurementItem"
      ALTER COLUMN "costActual" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("costActual")::numeric, 2);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'PurchaseOrder' AND c.relkind = 'r') THEN
    ALTER TABLE "PurchaseOrder"
      ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("totalAmount")::numeric, 2);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'DealPurchaseOrder' AND c.relkind = 'r') THEN
    ALTER TABLE "DealPurchaseOrder"
      ALTER COLUMN "total" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("total")::numeric, 2);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Invoice' AND c.relkind = 'r') THEN
    ALTER TABLE "Invoice"
      ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("amount")::numeric, 2);

    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "documentNumber" VARCHAR(64);
    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMP(3);
    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "counterpartyName" TEXT;
    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "counterpartyEdrpou" VARCHAR(12);
    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "vatRatePercent" DECIMAL(5,2);
    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "amountWithoutVat" DECIMAL(18,2);
    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "vatAmount" DECIMAL(18,2);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'PaymentPlanEntry' AND c.relkind = 'r') THEN
    ALTER TABLE "PaymentPlanEntry"
      ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2)
      USING ROUND(("amount")::numeric, 2);
    ALTER TABLE "PaymentPlanEntry"
      ALTER COLUMN "remainingAmount" SET DATA TYPE DECIMAL(18,2)
      USING CASE WHEN "remainingAmount" IS NULL THEN NULL ELSE ROUND(("remainingAmount")::numeric, 2) END;
  END IF;
END
$m$;
