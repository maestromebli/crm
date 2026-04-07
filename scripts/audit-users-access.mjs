/**
 * Аудит ролей і прав доступу (PermissionOnUser) для всіх користувачів.
 * Запуск: pnpm audit:users
 * Потрібен DATABASE_URL у .env / .env.local (як у інших db-скриптів).
 */
import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is missing. Set it in .env or .env.local.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Ключі, що найчастіше впливають на дашборд і хаби (для швидкого огляду). */
const DASHBOARD_RELATED = new Set([
  "DASHBOARD_VIEW",
  "PAYMENTS_VIEW",
  "MARGIN_VIEW",
  "COST_VIEW",
  "PRODUCTION_LAUNCH",
  "PRODUCTION_ORDERS_VIEW",
  "DEALS_VIEW",
  "LEADS_VIEW",
]);

function fmtMenu(menu) {
  if (menu == null) return "—";
  try {
    return JSON.stringify(menu);
  } catch {
    return String(menu);
  }
}

try {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      headManagerId: true,
      menuAccess: true,
      permissions: {
        select: {
          permission: { select: { key: true } },
        },
      },
    },
  });

  const byRole = {};
  for (const u of users) {
    byRole[u.role] = (byRole[u.role] || 0) + 1;
  }

  console.log("=== ENVER CRM — аудит користувачів і прав ===\n");
  console.log("Всього користувачів:", users.length);
  console.log("За ролями:", JSON.stringify(byRole, null, 2));
  console.log("");

  for (const u of users) {
    const keys = u.permissions
      .map((p) => p.permission.key)
      .sort((a, b) => a.localeCompare(b));
    const dash = keys.filter((k) => DASHBOARD_RELATED.has(k));

    console.log("—".repeat(72));
    console.log(`${u.email}${u.name ? `  (${u.name})` : ""}`);
    console.log(`  id: ${u.id}`);
    console.log(`  role: ${u.role}${u.role === "SUPER_ADMIN" ? "  [JWT: обхід перевірок прав, окрім impersonation]" : ""}`);
    if (u.headManagerId) console.log(`  headManagerId: ${u.headManagerId}`);
    console.log(`  permissions (${keys.length}): ${keys.join(", ") || "(немає записів)"}`);
    if (dash.length) {
      console.log(`  …дашборд/хаби (підмножина): ${dash.join(", ")}`);
    }
    console.log(`  menuAccess: ${fmtMenu(u.menuAccess)}`);
    console.log("");
  }

  console.log("=== кінець ===");
} finally {
  await prisma.$disconnect();
  await pool.end();
}
