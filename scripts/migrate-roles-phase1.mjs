/**
 * Одноразова міграція legacy ролей → етап 1 (без зміни PermissionOnUser).
 * MANAGER→HEAD_MANAGER, USER→SALES_MANAGER.
 * Роль ADMIN більше не мігрує в DIRECTOR — це окрема «операційна» роль (див. role-access-policy.ts).
 *
 * Запуск: pnpm db:migrate-roles
 */
import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Потрібен DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const m = await prisma.user.updateMany({
    where: { role: "MANAGER" },
    data: { role: "HEAD_MANAGER" },
  });
  const u = await prisma.user.updateMany({
    where: { role: "USER" },
    data: { role: "SALES_MANAGER" },
  });
  console.log(
    `OK: MANAGER→HEAD_MANAGER ${m.count}, USER→SALES_MANAGER ${u.count} (ADMIN залишається ADMIN)`,
  );
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
