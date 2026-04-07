/**
 * Вирівнює PermissionOnUser за політикою src/lib/authz/role-access-policy.ts
 * (копія логіки getDefaultPermissionKeysForRole — тримайте синхронно).
 *
 * За замовчуванням лише показує diff (dry-run).
 *   pnpm realign:permissions
 *   pnpm realign:permissions -- --email=demo@enver.local
 * Запис у БД:
 *   pnpm realign:permissions -- --apply --email=user@x.com
 *   pnpm realign:permissions -- --apply --all --yes
 */
import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

// --- sync with src/lib/authz/role-access-policy.ts ---
const ALL_PERMISSION_KEYS = [
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
  "AI_USE",
  "AI_ANALYTICS",
];

const HEAD_MANAGER_EXCLUDED = new Set([
  "USERS_MANAGE",
  "ROLES_MANAGE",
  "AUDIT_LOG_VIEW",
  "ADMIN_PANEL_VIEW",
]);

const OPERATIONAL_ADMIN_EXCLUDED = new Set(["ROLES_MANAGE"]);

const SALES_MANAGER_PERMISSION_KEYS = [
  "DASHBOARD_VIEW",
  "LEADS_VIEW",
  "LEADS_CREATE",
  "LEADS_UPDATE",
  "LEADS_ASSIGN",
  "CONTACTS_VIEW",
  "CALENDAR_VIEW",
  "TASKS_VIEW",
  "TASKS_CREATE",
  "TASKS_UPDATE",
  "TASKS_ASSIGN",
  "DEALS_VIEW",
  "DEALS_CREATE",
  "DEALS_UPDATE",
  "DEALS_ASSIGN",
  "DEALS_STAGE_CHANGE",
  "DEAL_WORKSPACE_VIEW",
  "NOTIFICATIONS_VIEW",
  "FILES_VIEW",
  "FILES_UPLOAD",
  "FILES_DELETE",
  "FILE_UPLOAD",
  "FILE_DELETE",
  "ESTIMATES_VIEW",
  "ESTIMATES_CREATE",
  "ESTIMATES_UPDATE",
  "QUOTES_CREATE",
  "CONTRACTS_VIEW",
  "CONTRACTS_CREATE",
  "CONTRACTS_UPDATE",
  "CONTRACT_VIEW",
  "CONTRACT_EDIT",
  "CONTRACT_SEND_SIGNATURE",
  "PAYMENTS_VIEW",
  "PAYMENTS_UPDATE",
  "PAYMENT_CONFIRM",
  "HANDOFF_SUBMIT",
  "READINESS_OVERRIDE_REQUEST",
  "PRODUCTION_LAUNCH",
  "REPORTS_VIEW",
  "ORDERS_VIEW",
  "PRODUCTS_VIEW",
  "AI_USE",
];

const MEASURER_PERMISSION_KEYS = [
  "DASHBOARD_VIEW",
  "LEADS_VIEW",
  "CALENDAR_VIEW",
  "TASKS_VIEW",
  "NOTIFICATIONS_VIEW",
  "AI_USE",
];

/**
 * @param {string} role
 * @returns {{ mode: "ALL" } | { mode: "KEYS", keys: string[] }}
 */
function getDefaultPermissionModeForRole(role) {
  switch (role) {
    case "SUPER_ADMIN":
    case "DIRECTOR":
      return { mode: "ALL" };
    case "HEAD_MANAGER":
    case "MANAGER":
      return {
        mode: "KEYS",
        keys: ALL_PERMISSION_KEYS.filter((k) => !HEAD_MANAGER_EXCLUDED.has(k)),
      };
    case "ADMIN":
      return {
        mode: "KEYS",
        keys: ALL_PERMISSION_KEYS.filter((k) => !OPERATIONAL_ADMIN_EXCLUDED.has(k)),
      };
    case "SALES_MANAGER":
    case "USER":
      return { mode: "KEYS", keys: [...SALES_MANAGER_PERMISSION_KEYS] };
    case "MEASURER":
      return { mode: "KEYS", keys: [...MEASURER_PERMISSION_KEYS] };
    case "ACCOUNTANT": {
      const keys = new Set(
        ALL_PERMISSION_KEYS.filter(
          (k) =>
            !HEAD_MANAGER_EXCLUDED.has(k) &&
            k !== "LEADS_ASSIGN" &&
            k !== "DEALS_ASSIGN",
        ),
      );
      keys.add("AI_USE");
      return { mode: "KEYS", keys: [...keys].sort() };
    }
    case "PROCUREMENT_MANAGER": {
      const keys = new Set(
        ALL_PERMISSION_KEYS.filter(
          (k) =>
            !HEAD_MANAGER_EXCLUDED.has(k) &&
            k !== "ROLES_MANAGE" &&
            k !== "USERS_MANAGE",
        ),
      );
      keys.add("AI_USE");
      keys.add("AI_ANALYTICS");
      return { mode: "KEYS", keys: [...keys].sort() };
    }
    default:
      return { mode: "KEYS", keys: [...SALES_MANAGER_PERMISSION_KEYS] };
  }
}

function parseArgs(argv) {
  let apply = false;
  let all = false;
  let yes = false;
  /** @type {string | undefined} */
  let email;
  /** @type {string | undefined} */
  let userId;
  for (const a of argv) {
    if (a === "--apply") apply = true;
    else if (a === "--all") all = true;
    else if (a === "--yes") yes = true;
    else if (a.startsWith("--email=")) email = a.slice("--email=".length);
    else if (a.startsWith("--user-id=")) userId = a.slice("--user-id=".length);
  }
  return { apply, all, yes, email, userId };
}

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ mode: "ALL" } | { mode: "KEYS", keys: string[] }} spec
 */
async function resolveExpectedPermissionIds(prisma, spec) {
  if (spec.mode === "ALL") {
    const rows = await prisma.permission.findMany({ select: { id: true } });
    return rows.map((r) => r.id);
  }
  const ids = [];
  const missing = [];
  for (const key of spec.keys) {
    const p = await prisma.permission.findUnique({
      where: { key },
      select: { id: true },
    });
    if (p) ids.push(p.id);
    else missing.push(key);
  }
  if (missing.length) {
    console.log(
      `[WARN] Немає рядків у таблиці Permission для ключів (пропускаємо): ${missing.join(", ")}`,
    );
  }
  return ids;
}

try {
  const { apply, all, yes, email, userId } = parseArgs(process.argv.slice(2));

  if (!all && !email && !userId) {
    console.log(`Використання:
  pnpm realign:permissions -- --email=user@company.com     # dry-run одного
  pnpm realign:permissions -- --user-id=cuid               # dry-run
  pnpm realign:permissions -- --all                        # dry-run усіх
  pnpm realign:permissions -- --apply --email=user@x.com     # запис
  pnpm realign:permissions -- --apply --all --yes            # запис усім (потрібно --yes)

Без --apply лише показує різницю з політикою ролі (role-access-policy).`);
    process.exit(1);
  }

  if (all && apply && !yes) {
    console.error(
      "Для --apply --all додайте --yes (підтвердження масового оновлення).",
    );
    process.exit(1);
  }

  if (all && (email || userId)) {
    console.error("Не комбінуйте --all з --email або --user-id.");
    process.exit(1);
  }

  /** @type {import("@prisma/client").Prisma.UserWhereInput} */
  const where = {};
  if (email) where.email = { equals: email, mode: "insensitive" };
  else if (userId) where.id = userId;
  else if (!all) {
    console.error("Внутрішня помилка: потрібен --all або email/user-id.");
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      permissions: {
        select: { permission: { select: { id: true, key: true } } },
      },
    },
  });

  if (!users.length) {
    console.log("Користувачів не знайдено.");
    process.exit(0);
  }

  for (const u of users) {
    const spec = getDefaultPermissionModeForRole(u.role);
    const expectedIds = await resolveExpectedPermissionIds(prisma, spec);
    const expectedSet = new Set(expectedIds);
    const currentKeys = u.permissions.map((x) => x.permission.key);
    const currentKeySet = new Set(currentKeys);
    const currentIdSet = new Set(u.permissions.map((x) => x.permission.id));

    const expectedKeyRows = await prisma.permission.findMany({
      where: { id: { in: expectedIds } },
      select: { key: true },
    });
    const expectedKeySet = new Set(expectedKeyRows.map((r) => r.key));

    const extra = [...currentKeySet].filter((k) => !expectedKeySet.has(k)).sort();
    const missing = [...expectedKeySet].filter((k) => !currentKeySet.has(k)).sort();

    let wouldRemove = 0;
    let wouldAdd = 0;
    for (const p of u.permissions) {
      if (!expectedSet.has(p.permission.id)) wouldRemove++;
    }
    wouldAdd = expectedIds.filter((id) => !currentIdSet.has(id)).length;

    const changed = wouldRemove > 0 || wouldAdd > 0;

    console.log("—".repeat(72));
    console.log(`${u.email}  role=${u.role}`);
    console.log(
      `  policy: ${spec.mode === "ALL" ? "ALL (усі Permission у БД)" : `${spec.keys.length} ключів`}`,
    );
    if (missing.length)
      console.log(`  не вистачає ключів: ${missing.join(", ")}`);
    if (extra.length)
      console.log(`  зайві (будуть прибрані при --apply): ${extra.join(", ")}`);
    console.log(
      `  зміни: −${wouldRemove} рядків, +${wouldAdd} рядків  ${changed ? "" : "(ok)"}`,
    );

    if (apply && changed) {
      await prisma.$transaction([
        prisma.permissionOnUser.deleteMany({ where: { userId: u.id } }),
        prisma.permissionOnUser.createMany({
          data: expectedIds.map((permissionId) => ({ userId: u.id, permissionId })),
          skipDuplicates: true,
        }),
      ]);
      console.log("  ✓ оновлено в БД");
    } else if (apply && !changed) {
      console.log("  (без змін)");
    }
  }

  if (!apply) {
    console.log("\nЦе dry-run. Для запису додайте --apply (для --all також --yes).");
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
