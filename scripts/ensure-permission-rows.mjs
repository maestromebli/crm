/**
 * Створює відсутні рядки в таблиці Permission для усіх ключів enum PermissionKey.
 * Ідемпотентно (upsert). Те саме джерело ключів, що prisma/seed.mjs → ensurePermissions().
 *
 * Запуск: pnpm db:ensure-permissions
 */
import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

/** Узгоджено з prisma/schema.prisma enum PermissionKey та prisma/seed.mjs */
const PERMISSION_KEYS = [
  "DASHBOARD_VIEW",
  "LEADS_VIEW",
  "CONTACTS_VIEW",
  "CALENDAR_VIEW",
  "TASKS_VIEW",
  "ORDERS_VIEW",
  "PRODUCTS_VIEW",
  "REPORTS_VIEW",
  "REPORTS_EXPORT",
  "NOTIFICATIONS_VIEW",
  "ADMIN_PANEL_VIEW",
  "SETTINGS_VIEW",
  "LEADS_CREATE",
  "LEADS_UPDATE",
  "LEADS_ASSIGN",
  "DEALS_VIEW",
  "DEALS_CREATE",
  "DEALS_UPDATE",
  "DEALS_ASSIGN",
  "DEALS_STAGE_CHANGE",
  "TASKS_CREATE",
  "TASKS_UPDATE",
  "TASKS_ASSIGN",
  "FILES_VIEW",
  "FILES_UPLOAD",
  "FILES_DELETE",
  "ESTIMATES_VIEW",
  "ESTIMATES_CREATE",
  "ESTIMATES_UPDATE",
  "QUOTES_CREATE",
  "CONTRACTS_VIEW",
  "CONTRACTS_CREATE",
  "CONTRACTS_UPDATE",
  "PAYMENTS_VIEW",
  "PAYMENTS_UPDATE",
  "COST_VIEW",
  "MARGIN_VIEW",
  "SETTINGS_MANAGE",
  "USERS_VIEW",
  "USERS_MANAGE",
  "ROLES_MANAGE",
  "AUDIT_LOG_VIEW",
  "DEAL_WORKSPACE_VIEW",
  "CONTRACT_VIEW",
  "CONTRACT_EDIT",
  "CONTRACT_APPROVE_INTERNAL",
  "CONTRACT_SEND_SIGNATURE",
  "FILE_UPLOAD",
  "FILE_DELETE",
  "READINESS_OVERRIDE_REQUEST",
  "READINESS_OVERRIDE_APPROVE",
  "HANDOFF_SUBMIT",
  "HANDOFF_ACCEPT",
  "PRODUCTION_LAUNCH",
  "PRODUCTION_ORDERS_VIEW",
  "PRODUCTION_ORDERS_MANAGE",
  "PRODUCTION_ORCHESTRATION_VIEW",
  "PRODUCTION_ORCHESTRATION_MANAGE",
  "PAYMENT_CONFIRM",
  "AI_USE",
  "AI_ANALYTICS",
];

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  let created = 0;
  let existing = 0;
  for (const key of PERMISSION_KEYS) {
    const before = await prisma.permission.findUnique({ where: { key } });
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        description: `Право: ${key}`,
      },
    });
    if (before) existing++;
    else created++;
  }
  console.log(
    `Permission: upsert завершено. Нових рядків: ${created}, вже були: ${existing}. Всього ключів: ${PERMISSION_KEYS.length}.`,
  );
} finally {
  await prisma.$disconnect();
  await pool.end();
}
