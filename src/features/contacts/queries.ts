import type { ContactCategory, ContactLifecycle, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { ContactListView } from "../../lib/contacts-route";
import type { AccessContext } from "../../lib/authz/data-scope";
import { ownerIdWhere } from "../../lib/authz/data-scope";
import {
  logPrismaError,
  userFacingPrismaMessage,
} from "../../lib/prisma-errors";

export type ContactListRow = {
  id: string;
  fullName: string;
  category: ContactCategory;
  phone: string | null;
  email: string | null;
  city: string | null;
  lifecycle: ContactLifecycle;
  clientName: string | null;
  clientType: "COMPANY" | "PERSON" | null;
  leadsCount: number;
  dealsCount: number;
  updatedAt: Date;
};

const listSelect = {
  id: true,
  fullName: true,
  category: true,
  phone: true,
  email: true,
  city: true,
  lifecycle: true,
  updatedAt: true,
  client: { select: { name: true, type: true } },
  _count: {
    select: {
      leads: true,
      deals: true,
    },
  },
} satisfies Prisma.ContactSelect;

async function repeatContactIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT d."primaryContactId" AS id
    FROM "Deal" d
    WHERE d."primaryContactId" IS NOT NULL
    GROUP BY d."primaryContactId"
    HAVING COUNT(*)::int >= 2
  `;
  return rows.map((r) => r.id).filter(Boolean);
}

function contactScopeWhere(
  ctx: AccessContext,
): Prisma.ContactWhereInput | undefined {
  const owners = ownerIdWhere(ctx);
  if (!owners) return undefined;
  return {
    OR: [
      { leads: { some: { ownerId: owners } } },
      { deals: { some: { ownerId: owners } } },
    ],
  };
}

function mergeContactWhere(
  base: Prisma.ContactWhereInput | undefined,
  scope: Prisma.ContactWhereInput | undefined,
): Prisma.ContactWhereInput | undefined {
  if (!scope) return base;
  if (!base) return scope;
  return { AND: [base, scope] };
}

function whereForView(
  view: ContactListView,
  repeatIds: string[] | null,
): Prisma.ContactWhereInput | undefined {
  switch (view) {
    case "all":
    case "segments":
    case "activity":
      return undefined;
    case "clients":
      return {
        OR: [{ lifecycle: "CUSTOMER" }, { clientId: { not: null } }],
      };
    case "partners":
      return {
        OR: [
          { instagramHandle: { not: null } },
          { telegramHandle: { not: null } },
        ],
      };
    case "repeat":
      if (!repeatIds?.length) {
        return { id: { in: ["__none__"] } };
      }
      return { id: { in: repeatIds } };
    default:
      return undefined;
  }
}

export async function listContactsByView(
  view: ContactListView,
  ctx: AccessContext,
): Promise<{ rows: ContactListRow[]; error: string | null }> {
  if (view === "activity") {
    return { rows: [], error: null };
  }

  try {
    const repeatIds = view === "repeat" ? await repeatContactIds() : null;
    const where = mergeContactWhere(
      whereForView(view, repeatIds),
      contactScopeWhere(ctx),
    );

    const rows = await prisma.contact.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: listSelect,
    });

    return {
      rows: rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        category: r.category,
        phone: r.phone,
        email: r.email,
        city: r.city,
        lifecycle: r.lifecycle,
        clientName: r.client?.name ?? null,
        clientType:
          r.client?.type === "COMPANY" || r.client?.type === "PERSON"
            ? r.client.type
            : null,
        leadsCount: r._count.leads,
        dealsCount: r._count.deals,
        updatedAt: r.updatedAt,
      })),
      error: null,
    };
  } catch (e) {
    logPrismaError("listContactsByView", e);
    return {
      rows: [],
      error: userFacingPrismaMessage(e, "Помилка завантаження контактів"),
    };
  }
}

export type ContactDetailLead = {
  id: string;
  title: string;
  stage: { name: string };
  owner: { name: string | null; email: string };
};

export type ContactDetailDeal = {
  id: string;
  title: string;
  status: string;
  stage: { name: string };
  client: { name: string };
};

export type ContactDetailLinkedLead = {
  leadId: string;
  title: string;
  role: string | null;
};

export type ContactDetailRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  category: ContactCategory;
  phone: string | null;
  email: string | null;
  instagramHandle: string | null;
  telegramHandle: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  lifecycle: ContactLifecycle;
  client: { id: string; name: string; type: string } | null;
  createdAt: Date;
  updatedAt: Date;
  leads: ContactDetailLead[];
  deals: ContactDetailDeal[];
  linkedLeads: ContactDetailLinkedLead[];
  companyContacts: Array<{
    id: string;
    fullName: string;
    category: ContactCategory;
    phone: string | null;
    email: string | null;
  }>;
};

const detailInclude = {
  client: {
    select: {
      id: true,
      name: true,
      type: true,
      contacts: {
        orderBy: { updatedAt: "desc" as const },
        select: {
          id: true,
          fullName: true,
          category: true,
          phone: true,
          email: true,
        },
      },
    },
  },
  leads: {
    orderBy: { updatedAt: "desc" as const },
    take: 30,
    select: {
      id: true,
      title: true,
      stage: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
  },
  deals: {
    orderBy: { updatedAt: "desc" as const },
    take: 30,
    select: {
      id: true,
      title: true,
      status: true,
      stage: { select: { name: true } },
      client: { select: { name: true } },
    },
  },
  leadContactLinks: {
    orderBy: { createdAt: "asc" as const },
    select: {
      role: true,
      lead: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  },
} satisfies Prisma.ContactInclude;

export async function getContactById(
  contactId: string,
  ctx: AccessContext,
): Promise<ContactDetailRow | null> {
  try {
    const row = await prisma.contact.findFirst({
      where: mergeContactWhere(
        { id: contactId },
        contactScopeWhere(ctx),
      ),
      include: detailInclude,
    });
    if (!row) return null;

    const linkedLeads: ContactDetailLinkedLead[] = row.leadContactLinks.map(
      (lc) => ({
        leadId: lc.lead.id,
        title: lc.lead.title,
        role: lc.role,
      }),
    );

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: row.fullName,
      category: row.category,
      phone: row.phone,
      email: row.email,
      instagramHandle: row.instagramHandle,
      telegramHandle: row.telegramHandle,
      city: row.city,
      country: row.country,
      notes: row.notes,
      lifecycle: row.lifecycle,
      client: row.client
        ? {
            id: row.client.id,
            name: row.client.name,
            type: row.client.type,
          }
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      leads: row.leads.map((l) => ({
        id: l.id,
        title: l.title,
        stage: l.stage,
        owner: l.owner,
      })),
      deals: row.deals.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        stage: d.stage,
        client: d.client,
      })),
      linkedLeads,
      companyContacts:
        row.client?.contacts
          .filter((c) => c.id !== row.id)
          .map((c) => ({
            id: c.id,
            fullName: c.fullName,
            category: c.category,
            phone: c.phone,
            email: c.email,
          })) ?? [],
    };
  } catch (e) {
    logPrismaError("getContactById", e);
    return null;
  }
}

export async function getLeadIdsForContact(
  contactId: string,
  ctx: AccessContext,
): Promise<string[]> {
  const owners = ownerIdWhere(ctx);
  const scopedLeadWhere = owners ? { ownerId: owners } : {};
  const [direct, linked] = await Promise.all([
    prisma.lead.findMany({
      where: { contactId, ...scopedLeadWhere },
      select: { id: true },
    }),
    prisma.leadContact.findMany({
      where: { contactId, lead: { is: scopedLeadWhere } },
      select: { leadId: true },
    }),
  ]);
  const ids = new Set<string>();
  for (const r of direct) ids.add(r.id);
  for (const r of linked) ids.add(r.leadId);
  return [...ids];
}

export type ContactLeadMessageRow = {
  id: string;
  body: string;
  channel: string;
  interactionKind: string;
  createdAt: Date;
  lead: { id: string; title: string };
  author: string;
};

export async function getContactLeadMessages(
  contactId: string,
  ctx: AccessContext,
): Promise<ContactLeadMessageRow[]> {
  const leadIds = await getLeadIdsForContact(contactId, ctx);
  if (!leadIds.length) return [];

  const rows = await prisma.leadMessage.findMany({
    where: { leadId: { in: leadIds } },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: {
      id: true,
      body: true,
      channel: true,
      interactionKind: true,
      createdAt: true,
      lead: { select: { id: true, title: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    channel: m.channel,
    interactionKind: m.interactionKind,
    createdAt: m.createdAt,
    lead: m.lead,
    author: m.createdBy.name?.trim() || m.createdBy.email,
  }));
}

export type ContactTaskRow = {
  id: string;
  title: string;
  status: string;
  dueAt: Date | null;
  entityType: string;
  entityId: string;
  assignee: { name: string | null; email: string };
};

export async function getContactRelatedTasks(
  contactId: string,
  ctx: AccessContext,
): Promise<ContactTaskRow[]> {
  const leadIds = await getLeadIdsForContact(contactId, ctx);
  const owners = ownerIdWhere(ctx);
  const dealRows = await prisma.deal.findMany({
    where: {
      primaryContactId: contactId,
      ...(owners ? { ownerId: owners } : {}),
    },
    select: { id: true },
  });
  const dealIds = dealRows.map((d) => d.id);

  const or: Prisma.TaskWhereInput[] = [];
  if (leadIds.length) {
    or.push({ entityType: "LEAD", entityId: { in: leadIds } });
  }
  if (dealIds.length) {
    or.push({ entityType: "DEAL", entityId: { in: dealIds } });
  }
  if (!or.length) return [];

  const rows = await prisma.task.findMany({
    where: { OR: or },
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
    take: 80,
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      entityType: true,
      entityId: true,
      assignee: { select: { name: true, email: true } },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dueAt: t.dueAt,
    entityType: t.entityType,
    entityId: t.entityId,
    assignee: t.assignee,
  }));
}

export type ContactAttachmentRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  category: string;
  createdAt: Date;
};

export async function getContactAttachments(
  contactId: string,
  ctx: AccessContext,
): Promise<ContactAttachmentRow[]> {
  const scope = contactScopeWhere(ctx);
  const allowed = await prisma.contact.findFirst({
    where: mergeContactWhere({ id: contactId }, scope),
    select: { id: true },
  });
  if (!allowed) return [];

  const rows = await prisma.attachment.findMany({
    where: {
      entityType: "CONTACT",
      entityId: contactId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      mimeType: true,
      category: true,
      createdAt: true,
    },
  });
  return rows.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    mimeType: a.mimeType,
    category: a.category,
    createdAt: a.createdAt,
  }));
}
