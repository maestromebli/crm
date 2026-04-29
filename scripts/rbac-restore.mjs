import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

function parseArgs(argv) {
  let file;
  let yes = false;
  for (const arg of argv) {
    if (arg.startsWith("--file=")) file = arg.slice("--file=".length);
    if (arg === "--yes") yes = true;
  }
  return { file, yes };
}

const { file, yes } = parseArgs(process.argv.slice(2));
if (!file) {
  console.error("Usage: pnpm rbac:restore -- --file=backups/rbac-snapshot-xxx.json --yes");
  process.exit(1);
}
if (!yes) {
  console.error("Restore is destructive. Add --yes to confirm.");
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), file);
const snapshot = JSON.parse(readFileSync(fullPath, "utf8"));
if (!Array.isArray(snapshot?.users)) {
  console.error("Invalid snapshot format.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  for (const user of snapshot.users) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (!dbUser) {
      console.warn(`[rbac:restore] skip missing user: ${user.email} (${user.id})`);
      continue;
    }

    const keys = Array.isArray(user.permissionKeys) ? user.permissionKeys : [];
    const perms = await prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    const existingKeys = new Set(perms.map((p) => p.key));
    const missingKeys = keys.filter((k) => !existingKeys.has(k));
    if (missingKeys.length > 0) {
      console.warn(
        `[rbac:restore] ${user.email}: missing Permission rows: ${missingKeys.join(", ")}`,
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          role: user.role,
          menuAccess: user.menuAccess ?? null,
        },
      }),
      prisma.permissionOnUser.deleteMany({
        where: { userId: user.id },
      }),
      prisma.permissionOnUser.createMany({
        data: perms.map((p) => ({
          userId: user.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  console.log(`[rbac:restore] completed from: ${fullPath}`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}

