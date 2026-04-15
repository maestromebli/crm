import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;
type ContactInsertRow = { id: string };

function isMissingColumnError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2022"
  );
}

function legacyContactId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function createContactLegacyCompatible(
  db: Db,
  input: { fullName: string; phone: string | null; email: string | null },
): Promise<{ id: string }> {
  const cols = await db.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('Contact', 'contact')
  `;
  const names = new Set(cols.map((c) => c.column_name));
  const id = legacyContactId();
  const fields: Array<{ key: string; value: unknown }> = [];

  if (names.has("id")) fields.push({ key: "id", value: id });
  if (names.has("fullName")) fields.push({ key: "fullName", value: input.fullName });
  if (names.has("phone")) fields.push({ key: "phone", value: input.phone });
  if (names.has("email")) fields.push({ key: "email", value: input.email });
  if (names.has("category")) fields.push({ key: "category", value: "OTHER" });
  if (names.has("lifecycle")) fields.push({ key: "lifecycle", value: "LEAD" });
  if (names.has("createdAt")) fields.push({ key: "createdAt", value: new Date() });
  if (names.has("updatedAt")) fields.push({ key: "updatedAt", value: new Date() });

  if (!fields.some((f) => f.key === "fullName")) {
    throw new Error("Legacy contact table has no fullName column.");
  }

  const sql = `INSERT INTO "Contact" (${fields
    .map((f) => `"${f.key}"`)
    .join(", ")}) VALUES (${fields
    .map((_, i) => `$${i + 1}`)
    .join(", ")}) RETURNING "id"`;
  const rows = await db.$queryRawUnsafe<ContactInsertRow[]>(
    sql,
    ...fields.map((f) => f.value),
  );
  const row = rows[0];
  if (!row?.id) {
    throw new Error("Legacy contact insert did not return id.");
  }
  return { id: row.id };
}

/**
 * Створює Contact + LeadContact (primary) і привʼязує до ліда, якщо ще немає contactId
 * і є мінімум даних (імʼя / телефон / email на картці ліда — без назви воронки).
 */
export async function ensureContactForLead(
  db: Db,
  leadId: string,
): Promise<{ created: boolean; contactId: string | null }> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      contactId: true,
      contactName: true,
      phone: true,
      email: true,
    },
  });

  if (!lead) {
    return { created: false, contactId: null };
  }
  if (lead.contactId) {
    return { created: false, contactId: lead.contactId };
  }

  const name = lead.contactName?.trim() ?? "";
  const phone = lead.phone?.trim() ?? "";
  const email = lead.email?.trim() ?? "";

  if (!name && !phone && !email) {
    return { created: false, contactId: null };
  }

  const fullName = name || phone || email || "Контакт";

  const contact = await (async () => {
    try {
      return await db.contact.create({
        data: {
          fullName,
          phone: phone || null,
          email: email || null,
        },
      });
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      return createContactLegacyCompatible(db, {
        fullName,
        phone: phone || null,
        email: email || null,
      });
    }
  })();

  await db.lead.update({
    where: { id: leadId },
    data: { contactId: contact.id },
  });

  await db.leadContact.upsert({
    where: {
      leadId_contactId: { leadId, contactId: contact.id },
    },
    create: {
      leadId,
      contactId: contact.id,
      isPrimary: true,
      isDecisionMaker: false,
    },
    update: {},
  });

  return { created: true, contactId: contact.id };
}
