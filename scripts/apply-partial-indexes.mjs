/**
 * Застосовує partial unique indexes з prisma/sql/partial_uniques.sql
 * (PostgreSQL не виражає їх через Prisma schema).
 *
 * Використання: node scripts/apply-partial-indexes.mjs
 */
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

config({ path: path.join(root, ".env.local") });
config({ path: path.join(root, ".env") });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Потрібен DATABASE_URL");
  process.exit(1);
}

const sqlPath = path.join(root, "prisma", "sql", "partial_uniques.sql");
const sql = fs.readFileSync(sqlPath, "utf-8");

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  await client.query(sql);
  console.log("OK: partial indexes застосовано з", sqlPath);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
