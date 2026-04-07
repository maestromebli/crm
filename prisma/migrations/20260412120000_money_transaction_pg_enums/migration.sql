-- PostgreSQL enum types for MoneyTransaction (align DB with prisma/schema.prisma).
-- Fixes: тип "public.MoneyTransactionType" не существует when Prisma casts filter values.

DO $m$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'MoneyTransactionType'
  ) THEN
    CREATE TYPE "MoneyTransactionType" AS ENUM ('INCOME', 'EXPENSE');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'MoneyTransactionStatus'
  ) THEN
    CREATE TYPE "MoneyTransactionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'MoneyTransactionCategory'
  ) THEN
    CREATE TYPE "MoneyTransactionCategory" AS ENUM (
      'PREPAYMENT',
      'FINAL_PAYMENT',
      'MATERIALS',
      'SALARY',
      'OTHER'
    );
  END IF;
END
$m$;

DO $m$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'MoneyTransaction' AND c.relkind = 'r'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE n.nspname = 'public' AND c.relname = 'MoneyTransaction'
        AND a.attname = 'type' AND NOT a.attisdropped
        AND t.typname IS DISTINCT FROM 'MoneyTransactionType'
    ) THEN
      ALTER TABLE "MoneyTransaction" ALTER COLUMN "type" DROP DEFAULT;
      ALTER TABLE "MoneyTransaction"
        ALTER COLUMN "type" TYPE "MoneyTransactionType"
        USING ("type"::text::"MoneyTransactionType");
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE n.nspname = 'public' AND c.relname = 'MoneyTransaction'
        AND a.attname = 'category' AND NOT a.attisdropped
        AND t.typname IS DISTINCT FROM 'MoneyTransactionCategory'
    ) THEN
      ALTER TABLE "MoneyTransaction" ALTER COLUMN "category" DROP DEFAULT;
      ALTER TABLE "MoneyTransaction"
        ALTER COLUMN "category" TYPE "MoneyTransactionCategory"
        USING ("category"::text::"MoneyTransactionCategory");
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE n.nspname = 'public' AND c.relname = 'MoneyTransaction'
        AND a.attname = 'status' AND NOT a.attisdropped
        AND t.typname IS DISTINCT FROM 'MoneyTransactionStatus'
    ) THEN
      ALTER TABLE "MoneyTransaction" ALTER COLUMN "status" DROP DEFAULT;
      ALTER TABLE "MoneyTransaction"
        ALTER COLUMN "status" TYPE "MoneyTransactionStatus"
        USING ("status"::text::"MoneyTransactionStatus");
    END IF;
  END IF;
END
$m$;
