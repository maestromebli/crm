import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

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

  const contact = await db.contact.create({
    data: {
      fullName,
      phone: phone || null,
      email: email || null,
    },
  });

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
