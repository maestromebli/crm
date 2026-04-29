import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

function parseArgs(argv) {
  let outFile;
  for (const arg of argv) {
    if (arg.startsWith("--out=")) outFile = arg.slice("--out=".length);
  }
  return { outFile };
}

const { outFile } = parseArgs(process.argv.slice(2));
const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      menuAccess: true,
      permissions: {
        select: {
          permission: {
            select: { key: true },
          },
        },
      },
    },
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    totalUsers: users.length,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      menuAccess: u.menuAccess,
      permissionKeys: u.permissions.map((p) => p.permission.key).sort(),
    })),
  };

  const target =
    outFile?.trim() ||
    `backups/rbac-snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const fullPath = path.resolve(process.cwd(), target);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`[rbac:snapshot] saved: ${fullPath}`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}

