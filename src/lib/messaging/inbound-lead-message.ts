import { appendActivityLog } from "../deal-api/audit";
import { prisma } from "../prisma";

function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}

type LeadTarget = {
  leadId: string;
  ownerId: string;
  contactId: string | null;
};

async function findLeadByTelegram(
  username: string,
  ownerId?: string | null,
): Promise<LeadTarget | null> {
  const value = username.replace(/^@/, "").trim();
  if (!value) return null;
  const lead = await prisma.lead.findFirst({
    where: {
      ...(ownerId?.trim() ? { ownerId: ownerId.trim() } : {}),
      contact: {
        telegramHandle: { equals: value, mode: "insensitive" },
      },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, ownerId: true, contactId: true },
  });
  return lead ? { leadId: lead.id, ownerId: lead.ownerId, contactId: lead.contactId } : null;
}

async function findLeadByPhone(
  phone: string,
  ownerId?: string | null,
): Promise<LeadTarget | null> {
  const digits = normalizePhone(phone);
  if (digits.length < 8) return null;
  const suffix = digits.slice(-10);
  const contacts = await prisma.contact.findMany({
    where: {
      phone: { contains: suffix },
    },
    select: { id: true, phone: true },
    take: 20,
  });
  const matched = contacts.find((c) => normalizePhone(c.phone ?? "").endsWith(suffix));
  if (!matched) return null;

  const lead = await prisma.lead.findFirst({
    where: {
      ...(ownerId?.trim() ? { ownerId: ownerId.trim() } : {}),
      OR: [
        { contactId: matched.id },
        { leadContacts: { some: { contactId: matched.id } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, ownerId: true, contactId: true },
  });
  return lead ? { leadId: lead.id, ownerId: lead.ownerId, contactId: lead.contactId } : null;
}

async function findLeadByInstagram(
  handleOrId: string,
  ownerId?: string | null,
): Promise<LeadTarget | null> {
  const value = handleOrId.replace(/^@/, "").trim();
  if (!value) return null;
  const lead = await prisma.lead.findFirst({
    where: {
      ...(ownerId?.trim() ? { ownerId: ownerId.trim() } : {}),
      contact: {
        instagramHandle: { equals: value, mode: "insensitive" },
      },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, ownerId: true, contactId: true },
  });
  return lead ? { leadId: lead.id, ownerId: lead.ownerId, contactId: lead.contactId } : null;
}

export async function resolveLeadTarget(args: {
  telegramUsername?: string | null;
  phone?: string | null;
  instagramHandle?: string | null;
  ownerId?: string | null;
}): Promise<LeadTarget | null> {
  if (args.telegramUsername?.trim()) {
    const byTg = await findLeadByTelegram(args.telegramUsername, args.ownerId);
    if (byTg) return byTg;
  }
  if (args.phone?.trim()) {
    const byPhone = await findLeadByPhone(args.phone, args.ownerId);
    if (byPhone) return byPhone;
  }
  if (args.instagramHandle?.trim()) {
    const byInstagram = await findLeadByInstagram(args.instagramHandle, args.ownerId);
    if (byInstagram) return byInstagram;
  }
  return null;
}

export async function storeInboundLeadMessage(args: {
  leadId: string;
  ownerId: string;
  contactId?: string | null;
  channel: "TELEGRAM" | "WHATSAPP" | "VIBER" | "INSTAGRAM";
  text: string;
  externalId: string;
  occurredAt?: Date;
  from?: string;
}): Promise<string> {
  const fromPart = args.from?.trim() ? `|from:${args.from.trim()}` : "";
  const row = await prisma.leadMessage.create({
    data: {
      leadId: args.leadId,
      contactId: args.contactId ?? null,
      body: args.text,
      channel: args.channel,
      interactionKind: "MESSAGE",
      summary: `in|${args.channel.toLowerCase()}|ext:${args.externalId}${fromPart}`,
      occurredAt: args.occurredAt,
      createdById: args.ownerId,
    },
    select: { id: true },
  });

  await appendActivityLog({
    entityType: "LEAD",
    entityId: args.leadId,
    type: "LEAD_UPDATED",
    actorUserId: args.ownerId,
    data: {
      note: "messenger_inbound",
      messageId: row.id,
      channel: args.channel,
      externalId: args.externalId,
    },
  });

  await prisma.lead.update({
    where: { id: args.leadId },
    data: { lastActivityAt: new Date() },
  });

  return row.id;
}

export async function markLeadMessageDeliveryStatus(args: {
  leadId: string;
  channel: "TELEGRAM" | "WHATSAPP" | "VIBER" | "INSTAGRAM";
  externalId: string;
  status: "sent" | "delivered" | "read" | "failed";
}): Promise<boolean> {
  const marker = `ext:${args.externalId}`;
  const row = await prisma.leadMessage.findFirst({
    where: {
      leadId: args.leadId,
      channel: args.channel,
      summary: { contains: marker },
    },
    select: { id: true, summary: true },
  });
  if (!row) return false;

  const summary = row.summary ?? "";
  const cleaned = summary
    .replace(/\|delivery:[^|]*/g, "")
    .replace(/\|status:[^|]*/g, "");
  const next = `${cleaned}|delivery:${args.status}`;

  await prisma.leadMessage.update({
    where: { id: row.id },
    data: { summary: next },
  });
  return true;
}
