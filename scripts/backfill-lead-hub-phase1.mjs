/**
 * Phase 1 backfill: для кожного Lead з contactId створює рядок LeadContact (primary),
 * якщо ще немає.
 * Запуск: pnpm db:backfill-lead-hub
 */
import { config } from "dotenv";
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

const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const leads = await prisma.lead.findMany({
    where: { contactId: { not: null } },
    select: { id: true, contactId: true },
  });
  let n = 0;
  for (const l of leads) {
    if (!l.contactId) continue;
    await prisma.leadContact.upsert({
      where: {
        leadId_contactId: { leadId: l.id, contactId: l.contactId },
      },
      create: {
        leadId: l.id,
        contactId: l.contactId,
        isPrimary: true,
        isDecisionMaker: false,
      },
      update: {},
    });
    n += 1;
  }
  console.log(`Готово: LeadContact upsert для ${n} лідів.`);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
