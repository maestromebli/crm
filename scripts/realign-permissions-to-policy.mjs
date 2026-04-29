/**
 * Вирівнює PermissionOnUser за політикою src/lib/authz/role-access-policy.ts
 * (копія логіки getDefaultPermissionKeysForRole — тримайте синхронно).
 *
 * За замовчуванням лише показує diff (dry-run).
 *   pnpm realign:permissions
 *   pnpm realign:permissions -- --email=demo@enver.local
 * Запис у БД (гібридний режим за замовчуванням):
 *   pnpm realign:permissions -- --apply --email=user@x.com
 *   pnpm realign:permissions -- --apply --all --yes
 *
 * Повне жорстке вирівнювання (з видаленням зайвих override-прав):
 *   pnpm realign:permissions -- --apply --strict --email=user@x.com
 *   pnpm realign:permissions -- --apply --strict --all --yes
 */
import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

config({ path: ".env.local" });
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.resolve(__dirname, "../config/rbac-role-policy.json");
const RBAC_CONTRACT = JSON.parse(readFileSync(contractPath, "utf8"));
const ALL_PERMISSION_KEYS = RBAC_CONTRACT.permissionKeys;

/**
 * @param {string} role
 * @returns {{ mode: "ALL" } | { mode: "KEYS", keys: string[] }}
 */
function getDefaultPermissionModeForRole(role) {
  const rule = RBAC_CONTRACT.roleRules?.[role] ?? RBAC_CONTRACT.defaultRule;
  if (!rule || !rule.mode) {
    return { mode: "KEYS", keys: [] };
  }
  if (rule.mode === "ALL") return { mode: "ALL" };
  if (rule.mode === "ALL_EXCEPT") {
    const excluded = new Set(rule.exclude ?? []);
    return {
      mode: "KEYS",
      keys: ALL_PERMISSION_KEYS.filter((key) => !excluded.has(key)),
    };
  }
  if (rule.mode === "SET") {
    const fromSet = RBAC_CONTRACT.namedPermissionSets?.[rule.set ?? ""];
    return { mode: "KEYS", keys: [...(fromSet ?? [])] };
  }
  return { mode: "KEYS", keys: [] };
}

function parseArgs(argv) {
  let apply = false;
  let strict = false;
  let all = false;
  let yes = false;
  /** @type {string | undefined} */
  let email;
  /** @type {string | undefined} */
  let userId;
  for (const a of argv) {
    if (a === "--apply") apply = true;
    else if (a === "--strict") strict = true;
    else if (a === "--all") all = true;
    else if (a === "--yes") yes = true;
    else if (a.startsWith("--email=")) email = a.slice("--email=".length);
    else if (a.startsWith("--user-id=")) userId = a.slice("--user-id=".length);
  }
  return { apply, strict, all, yes, email, userId };
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
  const { apply, strict, all, yes, email, userId } = parseArgs(process.argv.slice(2));

  if (!all && !email && !userId) {
    console.log(`Використання:
  pnpm realign:permissions -- --email=user@company.com     # dry-run одного
  pnpm realign:permissions -- --user-id=cuid               # dry-run
  pnpm realign:permissions -- --all                        # dry-run усіх
  pnpm realign:permissions -- --apply --email=user@x.com     # запис (гібрид: додає missing, не чіпає extras)
  pnpm realign:permissions -- --apply --all --yes            # запис усім (гібрид)
  pnpm realign:permissions -- --apply --strict --email=user@x.com
  pnpm realign:permissions -- --apply --strict --all --yes   # жорстко: baseline-only

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
      if (strict) {
        await prisma.$transaction([
          prisma.permissionOnUser.deleteMany({ where: { userId: u.id } }),
          prisma.permissionOnUser.createMany({
            data: expectedIds.map((permissionId) => ({ userId: u.id, permissionId })),
            skipDuplicates: true,
          }),
        ]);
        console.log("  ✓ strict baseline застосовано (extras видалено)");
      } else {
        const missingIds = expectedIds.filter((id) => !currentIdSet.has(id));
        if (missingIds.length > 0) {
          await prisma.permissionOnUser.createMany({
            data: missingIds.map((permissionId) => ({ userId: u.id, permissionId })),
            skipDuplicates: true,
          });
        }
        console.log("  ✓ hybrid baseline застосовано (extras збережено)");
      }
    } else if (apply && !changed) {
      console.log("  (без змін)");
    }
  }

  if (!apply) {
    console.log("\nЦе dry-run. Для hybrid-запису додайте --apply (для --all також --yes).");
    console.log("Для strict baseline (із видаленням extras) додайте --strict.");
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
