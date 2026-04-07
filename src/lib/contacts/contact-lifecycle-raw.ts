import type { PrismaClient } from "@prisma/client";

export type ContactLifecycleUi = "LEAD" | "CUSTOMER";

/**
 * Читає lifecycle без використання поля в Prisma select (клієнт може бути зібраний
 * до додавання колонки — тоді select падає з validation error).
 */
export async function fetchContactLifecycleById(
  prisma: PrismaClient,
  contactId: string,
): Promise<ContactLifecycleUi | undefined> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ v: string }>>(
      `SELECT lifecycle::text AS v FROM "Contact" WHERE id = $1 LIMIT 1`,
      contactId,
    );
    const v = rows[0]?.v;
    if (v === "LEAD" || v === "CUSTOMER") return v;
  } catch {
    /* колонки/enum ще немає */
  }
  return undefined;
}

/**
 * LEAD → CUSTOMER після повного підписання; якщо колонки немає — no-op.
 */
export async function updateContactLifecycleToCustomerRaw(
  prisma: PrismaClient,
  contactId: string,
): Promise<boolean> {
  try {
    const res = await prisma.$executeRawUnsafe(
      `UPDATE "Contact" SET lifecycle = 'CUSTOMER'::"ContactLifecycle" WHERE id = $1 AND lifecycle = 'LEAD'::"ContactLifecycle"`,
      contactId,
    );
    return typeof res === "number" ? res > 0 : true;
  } catch {
    return false;
  }
}
