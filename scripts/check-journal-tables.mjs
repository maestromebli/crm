/**
 * Перевірка наявності таблиць подвійного запису після `prisma migrate deploy`.
 * Запуск з кореня проєкту: node scripts/check-journal-tables.mjs
 */
import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Потрібен DATABASE_URL у .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const rows = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('LedgerAccount', 'FinanceJournalEntry', 'FinanceJournalLine')
    ORDER BY tablename
  `;
  const names = rows.map((r) => r.tablename);
  const required = ["LedgerAccount", "FinanceJournalEntry", "FinanceJournalLine"];
  const missing = required.filter((n) => !names.includes(n));
  if (missing.length) {
    console.error("Відсутні таблиці:", missing.join(", "));
    process.exit(1);
  }
  console.log("OK: таблиці журналу на місці:", names.join(", "));
} finally {
  await prisma.$disconnect();
  await pool.end();
}
