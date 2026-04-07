/**
 * Створює або оновлює admin@enver.com з паролем admin123 (SUPER_ADMIN).
 * Запуск: pnpm db:ensure-admin
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
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

/** Узгоджено з prisma/schema.prisma enum PermissionKey */
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
  "PAYMENT_CONFIRM",
];

const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function grantAllPermissions(userId) {
  const perms = await prisma.permission.findMany();
  for (const p of perms) {
    await prisma.permissionOnUser.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: p.id,
        },
      },
      update: {},
      create: { userId, permissionId: p.id },
    });
  }
}

try {
  for (const key of PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Право: ${key}` },
    });
  }

  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@enver.com" },
    update: {
      name: "Адміністратор",
      passwordHash,
      role: "SUPER_ADMIN",
    },
    create: {
      email: "admin@enver.com",
      name: "Адміністратор",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  await grantAllPermissions(admin.id);
  console.log("Готово: admin@enver.com / admin123 (SUPER_ADMIN, права оновлено)");
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
