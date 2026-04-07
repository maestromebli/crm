import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL?.trim();
console.log("DATABASE_URL:", url ? "set" : "MISSING (app falls back to 127.0.0.1:5432/postgres!)");

const pool = new pg.Pool({
  connectionString: url || "postgresql://127.0.0.1:5432/postgres",
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const user = await prisma.user.findFirst({
    where: { email: { equals: "admin@enver.com", mode: "insensitive" } },
    select: { id: true, email: true, role: true, passwordHash: true },
  });
  if (!user) {
    console.log("admin@enver.com: NOT FOUND — run pnpm db:ensure-admin");
    process.exit(1);
  }
  const ok = await bcrypt.compare("admin123", user.passwordHash);
  console.log("admin@enver.com found:", user.email, user.role);
  console.log("password admin123 matches:", ok);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
