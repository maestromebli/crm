import { Prisma, type AttachmentCategory } from "@prisma/client";
import type { ContactLifecycleUi } from "../../lib/contacts/contact-lifecycle-raw";
import { fetchContactLifecycleById } from "../../lib/contacts/contact-lifecycle-raw";
import { subMinutes } from "date-fns";
import {
  prisma,
  prismaCodegenIncludesEstimateName,
  prismaCodegenIncludesEstimateLeadId,
} from "../../lib/prisma";
import { leadFirstTouchSlaMinutes } from "../../lib/leads/lead-sla";
import { duplicateLeadIdsByPhone } from "../../lib/leads/lead-row-meta";
import {
  logPrismaError,
  userFacingPrismaMessage,
} from "../../lib/prisma-errors";
import type { LeadQualification } from "../../lib/leads/lead-qualification";
import { parseLeadQualification } from "../../lib/leads/lead-qualification";
import {
  buildLeadProposalHubSelect,
  mapLeadProposalHubRowToSummary,
} from "../../lib/leads/lead-proposal-hub-select";
import {
  type AccessContext,
  canAccessOwner,
  leadWhereForAccess,
  ownerIdWhere,
} from "../../lib/authz/data-scope";

const leadClientSupportsNextStep =
  typeof Prisma.LeadScalarFieldEnum === "object" &&
  Prisma.LeadScalarFieldEnum !== null &&
  Object.prototype.hasOwnProperty.call(Prisma.LeadScalarFieldEnum, "nextStep");

/** Include для списку та картки ліда (без залежності від Prisma.LeadInclude у Prisma 7). */
export const leadInclude = {
  owner: { select: { id: true, name: true, email: true } },
  stage: true,
  pipeline: true,
  contact: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      instagramHandle: true,
      telegramHandle: true,
    },
  },
} as const;

const leadDetailInclude = {
  owner: leadInclude.owner,
  stage: true,
  pipeline: {
    include: {
      stages: { orderBy: { sortOrder: "asc" as const } },
    },
  },
  contact: leadInclude.contact,
  deals: {
    where: { status: "OPEN" as const },
    orderBy: { updatedAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      title: true,
      stage: { select: { name: true } },
    },
  },
  leadContacts: {
    orderBy: { createdAt: "asc" as const },
    include: {
      contact: { select: { id: true, fullName: true } },
    },
  },
} as const;

export type LeadPipelineStageOption = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isFinal: boolean;
};

export type LeadLinkedDeal = {
  id: string;
  title: string;
  stage: { name: string };
};

export type LeadListRow = {
  id: string;
  title: string;
  source: string;
  pipelineId: string;
  stageId: string;
  priority: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  ownerId: string;
  contactId: string | null;
  clientId: string | null;
  dealId: string | null;
  nextStep: string | null;
  nextContactAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  stage: {
    id: string;
    pipelineId: string;
    name: string;
    slug: string;
    sortOrder: number;
    isFinal: boolean;
    finalType: string | null;
  };
  pipeline: {
    id: string;
    name: string;
    entityType: string;
    isDefault: boolean;
  };
  contact: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    instagramHandle: string | null;
    telegramHandle: string | null;
    /** Заповнюється в getLeadById через SQL, якщо колонка є в БД. */
    lifecycle?: ContactLifecycleUi;
  } | null;
};

/** Короткий зріз аналізу файлу ШІ (якщо вже створено). */
export type LeadFileIntelSummary = {
  processingStatus: string;
  detectedCategory: string | null;
  userConfirmedCategory: string | null;
  shortSummary: string | null;
  confidenceScore: number | null;
};

export type LeadAttachmentListItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  category: AttachmentCategory;
  createdAt: string;
  fileIntel: LeadFileIntelSummary | null;
};

export type LeadEstimateSummary = {
  id: string;
  name: string | null;
  version: number;
  status: string;
  totalPrice: number | null;
  templateKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** КП на етапі ліда (остання версія — перший елемент масиву). */
export type LeadProposalSummary = {
  id: string;
  version: number;
  status: string;
  estimateId: string | null;
  estimateVersion: number | null;
  sentAt: Date | null;
  approvedAt: Date | null;
  viewedAt: Date | null;
  publicToken: string | null;
  hasPdf: boolean;
  /** Шлях до PDF у сховищі (`/uploads/...`), якщо згенеровано. */
  pdfFileUrl: string | null;
  /** Є знімок смети (addon contract snapshotJson). */
  hasSnapshot: boolean;
  title: string | null;
  createdAt: Date;
};

export type LeadContactLinkRow = {
  contactId: string;
  fullName: string;
  isPrimary: boolean;
  role: string | null;
};

/** Розширені дані для сторінки картки ліда (стадії воронки, відкрита замовлення з ліда). */
export type LeadCalendarEventSummary = {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string;
};

export type LeadDetailRow = LeadListRow & {
  pipelineStages: LeadPipelineStageOption[];
  linkedDeal: LeadLinkedDeal | null;
  attachments: LeadAttachmentListItem[];
  qualification: LeadQualification;
  estimates: LeadEstimateSummary[];
  /** КП по ліду, за `version` спадно (для Hub — перший = актуальніший). */
  proposals: LeadProposalSummary[];
  /** Активні версії для Hub / CRM Core. */
  activeEstimateId: string | null;
  activeProposalId: string | null;
  /** Додаткові контакти ліда (для конверсії). */
  leadContacts: LeadContactLinkRow[];
  /** Події календаря, привʼязані до ліда (getLeadById). */
  calendarEvents: LeadCalendarEventSummary[];
  /** Зведення комунікацій по ліду (чат/нотатки/дзвінки). */
  communication: {
    messageCount: number;
    lastMessageAt: Date | null;
  };
  sourceDesigner: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  referral: {
    type: "DESIGNER" | "CONSTRUCTION_COMPANY" | "PERSON";
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  customerProfile: {
    type: "COMPANY" | "PERSON";
    name: string | null;
    contactsCount: number | null;
  } | null;
  /** Підтвердження умов до замовлення (для конверсії / CRM Core). */
  projectAgreed?: boolean;
};

export type LeadKpiCounts = {
  new: number;
  noResponse: number;
  noNextStep: number;
  unassigned: number;
  converted: number;
  lost: number;
};

function leadScopeWhere(ctx: AccessContext): Prisma.LeadWhereInput | undefined {
  return leadWhereForAccess(ctx);
}

function mergeLeadWhere(
  base: Prisma.LeadWhereInput | undefined,
  scope: Prisma.LeadWhereInput | undefined,
): Prisma.LeadWhereInput | undefined {
  if (!scope) return base;
  if (!base) return scope;
  return { AND: [base, scope] };
}

function endOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export async function getLeadKpiCounts(
  ctx: AccessContext,
): Promise<LeadKpiCounts | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  const scope = leadScopeWhere(ctx);
  const slaCutoff = subMinutes(new Date(), leadFirstTouchSlaMinutes());
  try {
    const noNextStepCountPromise = leadClientSupportsNextStep
      ? prisma.lead.count({
          where:
            mergeLeadWhere(
              {
                stage: { isFinal: false },
                AND: [
                  {
                    OR: [{ nextStep: null }, { nextStep: "" }],
                  },
                  { nextContactAt: null },
                ],
              },
              scope,
            ) ?? {},
        })
      : Promise.resolve(0);

    const [
      newCount,
      noResponse,
      noNextStep,
      unassigned,
      converted,
      lost,
    ] = await Promise.all([
      prisma.lead.count({
        where: mergeLeadWhere({ stage: { slug: "new" } }, scope) ?? {},
      }),
      prisma.lead.count({
        where:
          mergeLeadWhere(
            {
              stage: { slug: "new" },
              lastActivityAt: null,
              createdAt: { lt: slaCutoff },
            },
            scope,
          ) ?? {},
      }),
      noNextStepCountPromise,
      prisma.lead.count({
        where:
          mergeLeadWhere(
            {
              stage: { slug: "new" },
              lastActivityAt: null,
            },
            scope,
          ) ?? {},
      }),
      prisma.lead.count({
        where: mergeLeadWhere({ dealId: { not: null } }, scope) ?? {},
      }),
      prisma.lead.count({
        where:
          mergeLeadWhere(
            {
              stage: { slug: "lost" },
            },
            scope,
          ) ?? {},
      }),
    ]);
    return {
      new: newCount,
      noResponse,
      noNextStep,
      unassigned,
      converted,
      lost,
    };
  } catch (e) {
    logPrismaError("getLeadKpiCounts", e);
    return null;
  }
}

export async function listLeadsByView(
  view: string,
  ctx: AccessContext,
  options?: { mineUserId?: string },
): Promise<{ rows: LeadListRow[]; error: string | null }> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      rows: [],
      error:
        "Не задано `DATABASE_URL`. Додайте у `.env.local` рядок підключення до PostgreSQL і перезапустіть `pnpm dev`.",
    };
  }

  try {
    const orderBy = { updatedAt: "desc" as const };
    const scope = leadScopeWhere(ctx);
    const scopeWithoutArchived = mergeLeadWhere(
      { stage: { slug: { not: "archived" } } },
      scope,
    );
    const scopeActive = mergeLeadWhere(
      {
        stage: { slug: { not: "archived" } },
        NOT: [{ stage: { isFinal: true } }, { dealId: { not: null } }],
      },
      scope,
    );
    const qBase = { include: leadInclude, orderBy };
    const slaCutoff = subMinutes(new Date(), leadFirstTouchSlaMinutes());
    const now = new Date();

    switch (view) {
      case "all":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            ...(scopeActive ? { where: scopeActive } : {}),
          })) as LeadListRow[],
          error: null,
        };
      case "new":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere({ stage: { slug: "new" } }, scope),
          })) as LeadListRow[],
          error: null,
        };
      case "no-response":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere(
              {
                stage: { slug: "new" },
                lastActivityAt: null,
                createdAt: { lt: slaCutoff },
              },
              scope,
            ),
          })) as LeadListRow[],
          error: null,
        };
      case "no-next-step": {
        const whereNoNextStep: Prisma.LeadWhereInput = leadClientSupportsNextStep
          ? {
              stage: { isFinal: false },
              AND: [
                {
                  OR: [{ nextStep: null }, { nextStep: "" }],
                },
                { nextContactAt: null },
              ],
            }
          : {
              stage: { isFinal: false },
              nextContactAt: null,
            };
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere(whereNoNextStep, scope),
          })) as LeadListRow[],
          error: leadClientSupportsNextStep
            ? null
            : "Оновіть клієнт Prisma: pnpm prisma generate (поле nextStep на ліді).",
        };
      }
      case "overdue":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere(
              {
                stage: { isFinal: false },
                nextContactAt: { not: null, lt: now },
              },
              scope,
            ),
          })) as LeadListRow[],
          error: null,
        };
      case "duplicates": {
        const all = (await prisma.lead.findMany({
          ...qBase,
          ...(scopeActive ? { where: scopeActive } : {}),
        })) as LeadListRow[];
        const dupIds = duplicateLeadIdsByPhone(all);
        return {
          rows: all.filter((r) => dupIds.has(r.id)),
          error: null,
        };
      }
      case "re-contact":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere(
              {
                stage: { isFinal: false },
                nextContactAt: { not: null, lte: endOfTodayUtc() },
              },
              scope,
            ),
          })) as LeadListRow[],
          error: null,
        };
      case "converted":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere({ dealId: { not: null } }, scopeWithoutArchived),
          })) as LeadListRow[],
          error: null,
        };
      case "closed":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere(
              {
                stage: { slug: { not: "archived" } },
                OR: [{ stage: { isFinal: true } }, { dealId: { not: null } }],
              },
              scope,
            ),
          })) as LeadListRow[],
          error: null,
        };
      case "unassigned":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere(
              {
                stage: { slug: "new" },
                lastActivityAt: null,
              },
              scope,
            ),
          })) as LeadListRow[],
          error: null,
        };
      case "mine": {
        const oid = options?.mineUserId;
        if (!oid) {
          return { rows: [], error: null };
        }
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere({ ownerId: oid }, scopeActive),
          })) as LeadListRow[],
          error: null,
        };
      }
      case "qualified":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere({ stage: { slug: "qualified" } }, scope),
          })) as LeadListRow[],
          error: null,
        };
      case "lost":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere(
              {
                stage: { slug: "lost" },
              },
              scope,
            ),
          })) as LeadListRow[],
          error: null,
        };
      case "archived":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            where: mergeLeadWhere({ stage: { slug: "archived" } }, scope),
          })) as LeadListRow[],
          error: null,
        };
      case "sources":
      case "pipeline":
      case "import":
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            ...(scopeActive ? { where: scopeActive } : {}),
          })) as LeadListRow[],
          error: null,
        };
      default:
        return {
          rows: (await prisma.lead.findMany({
            ...qBase,
            ...(scopeActive ? { where: scopeActive } : {}),
          })) as LeadListRow[],
          error: null,
        };
    }
  } catch (e) {
    logPrismaError("listLeadsByView", e);
    return {
      rows: [],
      error: userFacingPrismaMessage(
        e,
        "Не вдалося зчитати ліди. Перевірте `DATABASE_URL`, виконайте `pnpm db:push` та `pnpm db:seed`.",
      ),
    };
  }
}

export async function getLeadById(
  id: string,
  ctx: AccessContext,
): Promise<LeadDetailRow | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }
  try {
    const row = await prisma.lead.findUnique({
      where: { id },
      include: leadDetailInclude,
    });
    if (!row) return null;
    if (!canAccessOwner(ctx, row.ownerId)) return null;

    const { pipeline: pFull, deals } = row;
    const pipeline = {
      id: pFull.id,
      name: pFull.name,
      entityType: pFull.entityType,
      isDefault: pFull.isDefault,
    };
    const pipelineStages: LeadPipelineStageOption[] = pFull.stages.map(
      (s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        sortOrder: s.sortOrder,
        isFinal: s.isFinal,
      }),
    );
    const firstDeal = deals[0];
    const linkedDeal: LeadLinkedDeal | null = firstDeal
      ? {
          id: firstDeal.id,
          title: firstDeal.title,
          stage: { name: firstDeal.stage.name },
        }
      : null;

    const attachmentRows = await prisma.attachment.findMany({
      where: {
        entityType: "LEAD",
        entityId: id,
        deletedAt: null,
        isCurrentVersion: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        mimeType: true,
        category: true,
        createdAt: true,
      },
    });
    const attachmentIds = attachmentRows.map((a) => a.id);
    const fileIntelByAttachmentId = new Map<string, LeadFileIntelSummary>();
    if (attachmentIds.length > 0) {
      const maybeFileAi = (
        prisma as unknown as {
          fileAiExtraction?: {
            findMany: (args: unknown) => Promise<
              Array<{
                attachmentId: string;
                processingStatus: string;
                detectedCategory: string | null;
                userConfirmedCategory: string | null;
                shortSummary: string | null;
                confidenceScore: number | null;
              }>
            >;
          };
        }
      ).fileAiExtraction;
      const intelRows = maybeFileAi
        ? await maybeFileAi
            .findMany({
              where: { attachmentId: { in: attachmentIds } },
              select: {
                attachmentId: true,
                processingStatus: true,
                detectedCategory: true,
                userConfirmedCategory: true,
                shortSummary: true,
                confidenceScore: true,
              },
            })
            .catch(() => [])
        : [];
      for (const intel of intelRows) {
        fileIntelByAttachmentId.set(intel.attachmentId, {
          processingStatus: intel.processingStatus,
          detectedCategory: intel.detectedCategory,
          userConfirmedCategory: intel.userConfirmedCategory,
          shortSummary: intel.shortSummary,
          confidenceScore: intel.confidenceScore,
        });
      }
    }
    const attachments: LeadAttachmentListItem[] = attachmentRows.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      mimeType: a.mimeType,
      category: a.category,
      createdAt: a.createdAt.toISOString(),
      fileIntel: fileIntelByAttachmentId.get(a.id) ?? null,
    }));

    const withEstimateName = prismaCodegenIncludesEstimateName();
    const estimateRows = prismaCodegenIncludesEstimateLeadId()
      ? await prisma.estimate.findMany({
          where: { leadId: id },
          orderBy: { version: "desc" },
          select: {
            id: true,
            ...(withEstimateName ? { name: true } : {}),
            version: true,
            status: true,
            totalPrice: true,
            templateKey: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : [];
    const estimates: LeadEstimateSummary[] = estimateRows.map((e) => ({
      id: e.id,
      name:
        withEstimateName && "name" in e
          ? ((e as { name?: string | null }).name ?? null)
          : null,
      version: e.version,
      status: e.status,
      totalPrice: e.totalPrice,
      templateKey: e.templateKey,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    const proposalRows = await prisma.leadProposal.findMany({
      where: { leadId: id },
      orderBy: { version: "desc" },
      take: 12,
      select: buildLeadProposalHubSelect(),
    });
    const proposals: LeadProposalSummary[] =
      proposalRows.map(mapLeadProposalHubRowToSummary);

    const qualification = parseLeadQualification(row.qualification);

    const calRows = await prisma.calendarEvent.findMany({
      where: { leadId: id },
      orderBy: { startAt: "asc" },
      take: 12,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        startAt: true,
        endAt: true,
      },
    });
    const calendarEvents: LeadCalendarEventSummary[] = calRows.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      status: e.status,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt.toISOString(),
    }));

    const [messageCount, lastMessage] = await Promise.all([
      prisma.leadMessage.count({ where: { leadId: id } }),
      prisma.leadMessage.findFirst({
        where: { leadId: id },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        select: { occurredAt: true, createdAt: true },
      }),
    ]);
    const lastMessageAt = lastMessage?.occurredAt ?? lastMessage?.createdAt ?? null;

    let contactOut: LeadListRow["contact"] = row.contact;
    if (row.contact) {
      const lc = await fetchContactLifecycleById(prisma, row.contact.id);
      contactOut =
        lc !== undefined
          ? { ...row.contact, lifecycle: lc }
          : row.contact;
    }

    const leadContacts: LeadContactLinkRow[] = row.leadContacts.map(
      (lc) => ({
        contactId: lc.contactId,
        fullName: lc.contact.fullName,
        isPrimary: lc.isPrimary,
        role: lc.role,
      }),
    );

    const hubMetaRaw =
      row.hubMeta && typeof row.hubMeta === "object" && !Array.isArray(row.hubMeta)
        ? (row.hubMeta as Record<string, unknown>)
        : null;
    const sourceDesignerRaw =
      hubMetaRaw?.sourceDesigner &&
      typeof hubMetaRaw.sourceDesigner === "object" &&
      !Array.isArray(hubMetaRaw.sourceDesigner)
        ? (hubMetaRaw.sourceDesigner as Record<string, unknown>)
        : null;
    const sourceDesigner = sourceDesignerRaw
      ? {
          userId:
            typeof sourceDesignerRaw.userId === "string"
              ? sourceDesignerRaw.userId
              : null,
          name:
            typeof sourceDesignerRaw.name === "string"
              ? sourceDesignerRaw.name
              : null,
          email:
            typeof sourceDesignerRaw.email === "string"
              ? sourceDesignerRaw.email
              : null,
        }
      : null;
    const referralRaw =
      hubMetaRaw?.referral &&
      typeof hubMetaRaw.referral === "object" &&
      !Array.isArray(hubMetaRaw.referral)
        ? (hubMetaRaw.referral as Record<string, unknown>)
        : null;
    const referralTypeRaw =
      typeof referralRaw?.type === "string" ? referralRaw.type : "PERSON";
    const referral: LeadDetailRow["referral"] = referralRaw
      ? {
          type:
            referralTypeRaw === "DESIGNER" ||
            referralTypeRaw === "CONSTRUCTION_COMPANY" ||
            referralTypeRaw === "PERSON"
              ? referralTypeRaw
              : "PERSON",
          name: typeof referralRaw.name === "string" ? referralRaw.name : null,
          phone: typeof referralRaw.phone === "string" ? referralRaw.phone : null,
          email: typeof referralRaw.email === "string" ? referralRaw.email : null,
        }
      : null;
    const customerRaw =
      hubMetaRaw?.customer &&
      typeof hubMetaRaw.customer === "object" &&
      !Array.isArray(hubMetaRaw.customer)
        ? (hubMetaRaw.customer as Record<string, unknown>)
        : null;
    const customerProfile: LeadDetailRow["customerProfile"] = customerRaw
      ? {
          type: customerRaw.type === "COMPANY" ? "COMPANY" : "PERSON",
          name: typeof customerRaw.name === "string" ? customerRaw.name : null,
          contactsCount:
            typeof customerRaw.contactsCount === "number"
              ? customerRaw.contactsCount
              : null,
        }
      : null;

    return {
      id: row.id,
      title: row.title,
      source: row.source,
      pipelineId: row.pipelineId,
      stageId: row.stageId,
      priority: row.priority,
      contactName: row.contactName,
      phone: row.phone,
      email: row.email,
      note: row.note,
      ownerId: row.ownerId,
      contactId: row.contactId,
      clientId: row.clientId,
      dealId: row.dealId,
      activeEstimateId: row.activeEstimateId,
      activeProposalId: row.activeProposalId,
      nextStep: row.nextStep,
      nextContactAt: row.nextContactAt,
      lastActivityAt: row.lastActivityAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      owner: row.owner,
      stage: row.stage,
      pipeline,
      contact: contactOut,
      pipelineStages,
      linkedDeal,
      attachments,
      qualification,
      estimates,
      proposals,
      leadContacts,
      calendarEvents,
      communication: {
        messageCount,
        lastMessageAt,
      },
      sourceDesigner,
      referral,
      customerProfile,
      projectAgreed: row.projectAgreed,
    };
  } catch (e) {
    logPrismaError("getLeadById", e);
    return null;
  }
}

export async function leadsGroupedByStage(
  ctx: AccessContext,
): Promise<{ stage: LeadListRow["stage"]; leads: LeadListRow[] }[]> {
  if (!process.env.DATABASE_URL?.trim()) return [];
  try {
    const leadPipeline = await prisma.pipeline.findFirst({
      where: { entityType: "LEAD" },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      include: { stages: { orderBy: { sortOrder: "asc" } } },
    });
    if (!leadPipeline?.stages.length) return [];

    const { rows, error } = await listLeadsByView("all", ctx);
    if (error) return [];

    const byStage = new Map<string, LeadListRow[]>();
    for (const lead of rows) {
      if (!byStage.has(lead.stageId)) byStage.set(lead.stageId, []);
      byStage.get(lead.stageId)!.push(lead);
    }

    return leadPipeline.stages.map((stage) => ({
      stage: {
        id: stage.id,
        pipelineId: stage.pipelineId,
        name: stage.name,
        slug: stage.slug,
        sortOrder: stage.sortOrder,
        isFinal: stage.isFinal,
        finalType: stage.finalType,
      },
      leads: byStage.get(stage.id) ?? [],
    }));
  } catch (e) {
    logPrismaError("leadsGroupedByStage", e);
    return [];
  }
}
