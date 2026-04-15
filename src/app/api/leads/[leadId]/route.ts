import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { appendActivityLog } from "../../../../lib/deal-api/audit";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { isLeadAssignableManagerRole } from "../../../../lib/leads/lead-owner-roles";
import { parseLeadQualification } from "../../../../lib/leads/lead-qualification";
import {
  dateToNextStepDateString,
  nextStepDateStringToDate,
} from "../../../../lib/leads/next-step-date";
import { getLeadById } from "../../../../features/leads/queries";
import { ensureContactForLead } from "../../../../lib/leads/ensure-contact-from-lead";
import {
  canAccessOwner,
  ownerIdWhere,
  resolveAccessContext,
  type AccessContext,
} from "../../../../lib/authz/data-scope";
import {
  canAdvance,
  getNextStage,
  mapLeadDetailRowToCoreInput,
  resolveLeadStageKey,
  validateLeadStageTransition,
  type TransitionValidationResult,
} from "../../../../lib/crm-core";
import { prisma } from "../../../../lib/prisma";
import { CORE_EVENT_TYPES, publishEntityEvent } from "../../../../lib/events/crm-events";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "../../../../features/event-system";

const PRIORITIES = new Set(["low", "normal", "high"]);
const LEAD_DELETE_ALLOWED_ROLES = new Set([
  "SUPER_ADMIN",
  "HEAD_MANAGER",
  "MANAGER",
  "ADMIN",
  "DIRECTOR",
]);

type Ctx = { params: Promise<{ leadId: string }> };

type StageTransitionSummary = Pick<
  TransitionValidationResult,
  "warnings" | "missingRequirements"
>;

type AutoAdvanceMeta = {
  applied: boolean;
  fromStageId: string | null;
  toStageId: string | null;
  warnings: TransitionValidationResult["warnings"];
  missingRequirements: TransitionValidationResult["missingRequirements"];
  reasonUa: string | null;
};

type PatchLeadSnapshot = {
  id: string;
  ownerId: string | null;
  pipelineId: string;
  qualification: unknown;
  hubMeta: unknown;
  stageId: string;
  stage: {
    slug: string;
    isFinal: boolean;
    finalType: string | null;
  };
};

type PersistedLead = NonNullable<Awaited<ReturnType<typeof prisma.lead.findUnique>>>;

function createAutoAdvanceMeta(args: {
  leadStageId: string;
  requested: boolean;
  stageTransition: StageTransitionSummary | undefined;
}): AutoAdvanceMeta {
  return {
    applied: false,
    fromStageId: args.leadStageId,
    toStageId: null,
    warnings: args.stageTransition?.warnings ?? [],
    missingRequirements: args.stageTransition?.missingRequirements ?? [],
    reasonUa: args.requested ? "Наразі немає підстав для автоматичного переходу." : null,
  };
}

async function resolveManualStageChange(args: {
  leadId: string;
  accessCtx: AccessContext;
  lead: PatchLeadSnapshot;
  requestedStageId: string;
}): Promise<{
  response?: NextResponse;
  nextStageId?: string;
  stageTransition?: StageTransitionSummary;
}> {
  if (!args.requestedStageId) return {};

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: args.requestedStageId, pipelineId: args.lead.pipelineId },
  });
  if (!stage) {
    return {
      response: NextResponse.json(
        { error: "Стадія не належить воронці цього ліда" },
        { status: 400 },
      ),
    };
  }

  if (stage.id === args.lead.stageId) return {};

  const detail = await getLeadById(args.leadId, args.accessCtx);
  if (!detail) {
    return {
      response: NextResponse.json({ error: "Лід не знайдено" }, { status: 404 }),
    };
  }

  const fromKey = resolveLeadStageKey(args.lead.stage.slug, {
    isFinal: args.lead.stage.isFinal,
    finalType: args.lead.stage.finalType,
  });
  const toKey = resolveLeadStageKey(stage.slug, {
    isFinal: stage.isFinal,
    finalType: stage.finalType,
  });
  const tv = validateLeadStageTransition(
    fromKey,
    toKey,
    mapLeadDetailRowToCoreInput(detail),
  );
  if (!tv.ok) {
    return {
      response: NextResponse.json(
        {
          error: tv.errors.map((e) => e.messageUa).join(" · "),
          transitionErrors: tv.errors,
          transitionWarnings: tv.warnings,
          missingRequirements: tv.missingRequirements,
        },
        { status: 400 },
      ),
    };
  }

  return {
    nextStageId: stage.id,
    stageTransition: {
      warnings: tv.warnings,
      missingRequirements: tv.missingRequirements,
    },
  };
}

async function tryAutoAdvanceStage(args: {
  leadId: string;
  accessCtx: AccessContext;
  requestedStageUpdate: boolean;
  autoAdvanceRequested: boolean;
  meta: AutoAdvanceMeta;
}): Promise<{
  updatedLead: PersistedLead | null;
  stageChanged: boolean;
  autoStageApplied: boolean;
  meta: AutoAdvanceMeta;
}> {
  if (args.requestedStageUpdate) {
    return {
      updatedLead: null,
      stageChanged: false,
      autoStageApplied: false,
      meta: args.meta,
    };
  }

  const refreshed = await getLeadById(args.leadId, args.accessCtx);
  if (!refreshed) {
    if (args.autoAdvanceRequested) {
      args.meta.reasonUa = "Не вдалося перевірити стан ліда для авто-переходу.";
    }
    return {
      updatedLead: null,
      stageChanged: false,
      autoStageApplied: false,
      meta: args.meta,
    };
  }

  const core = mapLeadDetailRowToCoreInput(refreshed);
  const nextKey = getNextStage(core.stageKey);
  if (!nextKey) {
    if (args.autoAdvanceRequested) {
      args.meta.reasonUa = "Для поточної стадії немає автоматичного наступного етапу.";
    }
    return {
      updatedLead: null,
      stageChanged: false,
      autoStageApplied: false,
      meta: args.meta,
    };
  }

  const autoTv = validateLeadStageTransition(core.stageKey, nextKey, core);
  if (!autoTv.ok) {
    args.meta.warnings = autoTv.warnings;
    args.meta.missingRequirements = autoTv.missingRequirements;
  }

  if (!canAdvance(core.stageKey, core, nextKey)) {
    if (args.autoAdvanceRequested) {
      args.meta.reasonUa =
        "Для авто-переходу ще не виконані обовʼязкові умови наступного етапу.";
    }
    return {
      updatedLead: null,
      stageChanged: false,
      autoStageApplied: false,
      meta: args.meta,
    };
  }

  const autoNextStage = refreshed.pipelineStages.find((s) => {
    const key = resolveLeadStageKey(s.slug, { isFinal: s.isFinal });
    return key === nextKey;
  });

  if (!autoNextStage || autoNextStage.id === refreshed.stageId) {
    if (args.autoAdvanceRequested) {
      args.meta.reasonUa = "Поточна стадія вже відповідає умовам.";
    }
    return {
      updatedLead: null,
      stageChanged: false,
      autoStageApplied: false,
      meta: args.meta,
    };
  }

  const updatedLead = await prisma.lead.update({
    where: { id: args.leadId },
    data: { stageId: autoNextStage.id },
  });

  args.meta.applied = true;
  args.meta.fromStageId = refreshed.stageId;
  args.meta.toStageId = autoNextStage.id;
  args.meta.reasonUa = null;

  return {
    updatedLead,
    stageChanged: true,
    autoStageApplied: true,
    meta: args.meta,
  };
}

/**
 * Повний зріз ліда для клієнтського кешу (React Query) та Hub workspace.
 */
export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_VIEW);
  if (denied) return denied;

  const { leadId } = await ctx.params;
  const accessCtx = await resolveAccessContext(prisma, user);
  const lead = await getLeadById(leadId, accessCtx);
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      ownerId: true,
      pipelineId: true,
      qualification: true,
      hubMeta: true,
      stageId: true,
      stage: {
        select: { slug: true, isFinal: true, finalType: true },
      },
    },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;
  const accessCtx: AccessContext = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  const ownerWhere = ownerIdWhere(accessCtx);

  let stageTransitionForResponse: StageTransitionSummary | undefined;

  let body: {
    title?: string;
    source?: string;
    priority?: string;
    note?: string | null;
    nextStep?: string | null;
    /** ISO `YYYY-MM-DD` — те саме поле, що й `nextContactAt` (день наступного контакту). */
    nextStepDate?: string | null;
    nextContactAt?: string | null;
    /** Оновити lastActivityAt (перший дотик / дзвінок). */
    recordTouch?: boolean;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    stageId?: string;
    contactId?: string | null;
    /** Часткове оновлення кваліфікації (Lead Hub). */
    qualification?: Record<string, unknown> | null;
    /** Перепризначення відповідального (HEAD / ADMIN — LEADS_ASSIGN). */
    ownerId?: string | null;
    /** Спробувати автоматично перевести на наступну стадію без ручного вибору. */
    autoAdvance?: boolean;
    referralType?: "DESIGNER" | "CONSTRUCTION_COMPANY" | "PERSON" | null;
    referralName?: string | null;
    referralPhone?: string | null;
    referralEmail?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) {
      return NextResponse.json({ error: "Назва не може бути порожньою" }, {
        status: 400,
      });
    }
    patch.title = t;
  }

  if (typeof body.source === "string") {
    const s = body.source.trim();
    if (s) patch.source = s;
  }

  if (typeof body.priority === "string" && PRIORITIES.has(body.priority)) {
    patch.priority = body.priority;
  }

  if (body.note === null) patch.note = null;
  else if (typeof body.note === "string") patch.note = body.note.trim() || null;

  if (body.nextStep === null) patch.nextStep = null;
  else if (typeof body.nextStep === "string") {
    const s = body.nextStep.trim();
    patch.nextStep = s ? s.slice(0, 500) : null;
  }

  const hasNextContactAtKey = "nextContactAt" in body;
  if (hasNextContactAtKey) {
    if (body.nextContactAt === null) patch.nextContactAt = null;
    else if (
      typeof body.nextContactAt === "string" &&
      body.nextContactAt.trim()
    ) {
      const d = new Date(body.nextContactAt.trim());
      if (!Number.isNaN(d.getTime())) patch.nextContactAt = d;
    }
  } else if ("nextStepDate" in body) {
    if (body.nextStepDate === null || body.nextStepDate === "") {
      patch.nextContactAt = null;
    } else if (typeof body.nextStepDate === "string") {
      const d = nextStepDateStringToDate(body.nextStepDate);
      if (!d) {
        return NextResponse.json(
          { error: "nextStepDate очікує формат YYYY-MM-DD" },
          { status: 400 },
        );
      }
      patch.nextContactAt = d;
    }
  }

  if (body.recordTouch === true) {
    patch.lastActivityAt = new Date();
  }

  if (body.contactName === null) patch.contactName = null;
  else if (typeof body.contactName === "string") {
    patch.contactName = body.contactName.trim() || null;
  }

  if (body.phone === null) patch.phone = null;
  else if (typeof body.phone === "string") {
    patch.phone = body.phone.trim() || null;
  }

  if (body.email === null) patch.email = null;
  else if (typeof body.email === "string") {
    patch.email = body.email.trim() || null;
  }

  const requestedStageId =
    typeof body.stageId === "string" ? body.stageId.trim() : "";
  const manualStage = await resolveManualStageChange({
    leadId,
    accessCtx,
    lead: lead as PatchLeadSnapshot,
    requestedStageId,
  });
  if (manualStage.response) return manualStage.response;
  if (manualStage.nextStageId) {
    patch.stageId = manualStage.nextStageId;
  }
  if (manualStage.stageTransition) {
    stageTransitionForResponse = manualStage.stageTransition;
  }

  if ("contactId" in body) {
    if (body.contactId === null || body.contactId === "") {
      patch.contactId = null;
    } else if (typeof body.contactId === "string" && body.contactId.trim()) {
      const cid = body.contactId.trim();
      const c = await prisma.contact.findUnique({
        where: { id: cid },
        select: {
          id: true,
          leads: { select: { ownerId: true }, take: 10 },
          deals: { select: { ownerId: true }, take: 10 },
        },
      });
      if (!c) {
        return NextResponse.json({ error: "Контакт не знайдено" }, {
          status: 400,
        });
      }
      if (ownerWhere) {
        const visibleByLead = c.leads.some((l) => l.ownerId && canAccessOwner(accessCtx, l.ownerId));
        const visibleByDeal = c.deals.some((d) => d.ownerId && canAccessOwner(accessCtx, d.ownerId));
        if (!visibleByLead && !visibleByDeal) {
          return NextResponse.json(
            { error: "Недостатньо прав на цей контакт" },
            { status: 403 },
          );
        }
      }
      patch.contactId = cid;
    }
  }

  if (
    body.qualification !== undefined &&
    body.qualification !== null &&
    typeof body.qualification === "object" &&
    !Array.isArray(body.qualification)
  ) {
    const base = parseLeadQualification(lead.qualification);
    const inc = body.qualification as Record<string, unknown>;
    const merged = { ...base };
    for (const key of Object.keys(inc)) {
      const v = inc[key];
      if (v === null) {
        (merged as Record<string, unknown>)[key] = null;
      } else if (typeof v === "string") {
        (merged as Record<string, unknown>)[key] = v;
      }
    }
    patch.qualification = merged;
  }

  if (body.ownerId !== undefined) {
    if (body.ownerId === null || body.ownerId === "") {
      return NextResponse.json(
        { error: "ownerId не може бути порожнім — оберіть користувача" },
        { status: 400 },
      );
    }
    if (typeof body.ownerId === "string" && body.ownerId.trim()) {
      const assignDenied = forbidUnlessPermission(user, P.LEADS_ASSIGN);
      if (assignDenied) return assignDenied;
      const nid = body.ownerId.trim();
      if (nid === lead.ownerId) {
        /* no-op */
      } else {
        const assignee = await prisma.user.findUnique({
          where: { id: nid },
          select: { id: true, role: true },
        });
        if (!assignee) {
          return NextResponse.json(
            { error: "Користувача не знайдено" },
            { status: 400 },
          );
        }
        if (!isLeadAssignableManagerRole(assignee.role)) {
          return NextResponse.json(
            { error: "Цю роль неможна призначити відповідальним за лід" },
            { status: 400 },
          );
        }
        if (!canAccessOwner(accessCtx, assignee.id)) {
          return NextResponse.json(
            { error: "Недостатньо прав призначити цього менеджера" },
            { status: 403 },
          );
        }
        patch.ownerId = assignee.id;
      }
    }
  }

  if (
    body.referralType !== undefined ||
    body.referralName !== undefined ||
    body.referralPhone !== undefined ||
    body.referralEmail !== undefined
  ) {
    const existingHubMeta =
      lead.hubMeta && typeof lead.hubMeta === "object" && !Array.isArray(lead.hubMeta)
        ? { ...(lead.hubMeta as Record<string, unknown>) }
        : {};
    const existingReferral =
      existingHubMeta.referral &&
      typeof existingHubMeta.referral === "object" &&
      !Array.isArray(existingHubMeta.referral)
        ? (existingHubMeta.referral as Record<string, unknown>)
        : {};

    const typeRaw =
      body.referralType === null || body.referralType === undefined
        ? String(existingReferral.type ?? "PERSON")
        : String(body.referralType);
    const referralType =
      typeRaw === "DESIGNER" ||
      typeRaw === "CONSTRUCTION_COMPANY" ||
      typeRaw === "PERSON"
        ? typeRaw
        : null;
    if (!referralType) {
      return NextResponse.json(
        { error: "referralType має бути DESIGNER | CONSTRUCTION_COMPANY | PERSON" },
        { status: 400 },
      );
    }

    const referralName =
      body.referralName === undefined
        ? (typeof existingReferral.name === "string" ? existingReferral.name : null)
        : body.referralName?.trim() || null;
    const referralPhone =
      body.referralPhone === undefined
        ? (typeof existingReferral.phone === "string" ? existingReferral.phone : null)
        : body.referralPhone?.trim() || null;
    const referralEmail =
      body.referralEmail === undefined
        ? (typeof existingReferral.email === "string" ? existingReferral.email : null)
        : body.referralEmail?.trim() || null;

    const hasAnyReferralValue = Boolean(referralName || referralPhone || referralEmail);
    if (hasAnyReferralValue) {
      existingHubMeta.referral = {
        type: referralType,
        name: referralName,
        phone: referralPhone,
        email: referralEmail,
      };
    } else {
      delete existingHubMeta.referral;
    }
    patch.hubMeta = existingHubMeta;
  }

  const autoAdvanceRequested = body.autoAdvance === true;
  if (Object.keys(patch).length === 0 && !autoAdvanceRequested) {
    return NextResponse.json({ error: "Немає полів для оновлення" }, {
      status: 400,
    });
  }

  try {
    let stageChanged =
      typeof patch.stageId === "string" && patch.stageId !== lead.stageId;
    const requestedStageUpdate = typeof patch.stageId === "string";
    const autoAdvanceMeta = createAutoAdvanceMeta({
      leadStageId: lead.stageId,
      requested: autoAdvanceRequested,
      stageTransition: stageTransitionForResponse,
    });

    let updated = Object.keys(patch).length
      ? await prisma.lead.update({
          where: { id: leadId },
          data: patch,
        })
      : await prisma.lead.findUnique({ where: { id: leadId } });
    if (!updated) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }

    const autoAdvanceResult = await tryAutoAdvanceStage({
      leadId,
      accessCtx,
      requestedStageUpdate,
      autoAdvanceRequested,
      meta: autoAdvanceMeta,
    });
    if (autoAdvanceResult.updatedLead) {
      updated = autoAdvanceResult.updatedLead;
    }
    stageChanged = stageChanged || autoAdvanceResult.stageChanged;
    const autoStageApplied = autoAdvanceResult.autoStageApplied;

    try {
      await ensureContactForLead(prisma, leadId);
    } catch (contactSyncError) {
      // Не блокуємо збереження ліда через дрейф схеми contact-таблиці.
      console.warn(
        "[PATCH leads/[leadId]] ensureContactForLead skipped",
        contactSyncError,
      );
    }

    const contactIdAfter =
      (
        await prisma.lead.findUnique({
          where: { id: leadId },
          select: { contactId: true },
        })
      )?.contactId ?? updated.contactId;

    const changedFields = Object.keys(patch);
    if (autoStageApplied && !changedFields.includes("stageId")) {
      changedFields.push("stageId");
    }

    if (changedFields.length > 0) {
      await appendActivityLog({
        entityType: "LEAD",
        entityId: leadId,
        type: "LEAD_UPDATED",
        actorUserId: user.id,
        data: { fields: changedFields },
      });
    }
    if (stageChanged) {
      await publishEntityEvent({
        type: CORE_EVENT_TYPES.STATUS_CHANGED,
        entityType: "LEAD",
        entityId: leadId,
        userId: user.id,
        payload: {
          fromStageId: lead.stageId,
          toStageId: updated.stageId,
        },
      });
    }
    if (typeof patch.ownerId === "string" && patch.ownerId !== lead.ownerId) {
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.LEAD_ASSIGNED,
        { leadId, ownerId: patch.ownerId },
        {
          entityType: "LEAD",
          entityId: leadId,
          userId: user.id,
          dedupeKey: `lead-assigned:${leadId}:${patch.ownerId}`,
        },
      );
    }
    if (body.recordTouch === true) {
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.CONTACT_COMPLETED,
        { leadId },
        {
          entityType: "LEAD",
          entityId: leadId,
          userId: user.id,
          dedupeKey: `contact-completed:${leadId}:${new Date().toISOString().slice(0, 10)}`,
        },
      );
    }

    revalidatePath("/leads");
    revalidatePath("/leads/new");
    revalidatePath("/leads/no-response");
    revalidatePath("/leads/no-next-step");
    revalidatePath("/leads/overdue");
    revalidatePath("/leads/duplicates");
    revalidatePath("/leads/re-contact");
    revalidatePath("/leads/closed");
    revalidatePath("/leads/converted");
    revalidatePath("/leads/unassigned");
    revalidatePath("/leads/lost");
    revalidatePath("/leads/archived");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/contact`);
    revalidatePath(`/leads/${leadId}/activity`);

    return NextResponse.json({
      ok: true,
      ...(stageTransitionForResponse
        ? { stageTransition: stageTransitionForResponse }
        : {}),
      ...(autoAdvanceRequested
        ? {
            autoAdvance: {
              applied: autoAdvanceMeta.applied,
              fromStageId: autoAdvanceMeta.fromStageId,
              toStageId: autoAdvanceMeta.toStageId,
              warnings: autoAdvanceMeta.warnings,
              missingRequirements: autoAdvanceMeta.missingRequirements,
              reasonUa: autoAdvanceMeta.reasonUa,
            },
          }
        : {}),
      lead: {
        id: updated.id,
        title: updated.title,
        source: updated.source,
        priority: updated.priority,
        note: updated.note,
        nextStep: updated.nextStep,
        nextStepDate: dateToNextStepDateString(updated.nextContactAt),
        nextContactAt: updated.nextContactAt?.toISOString() ?? null,
        lastActivityAt: updated.lastActivityAt?.toISOString() ?? null,
        contactName: updated.contactName,
        phone: updated.phone,
        email: updated.email,
        stageId: updated.stageId,
        contactId: contactIdAfter,
        updatedAt: updated.updatedAt.toISOString(),
        qualification: updated.qualification,
        ownerId: updated.ownerId,
      },
    });
  } catch (e) {
     
    console.error("[PATCH leads/[leadId]]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  if (!LEAD_DELETE_ALLOWED_ROLES.has(user.dbRole)) {
    return NextResponse.json(
      { error: "Видаляти ліди можуть лише головний менеджер, адміністратор або директор" },
      { status: 403 },
    );
  }

  const { leadId } = await ctx.params;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, dealId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  if (lead.dealId) {
    return NextResponse.json(
      { error: "Неможливо видалити лід, який уже конвертовано в угоду" },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.calendarEvent.updateMany({
        where: { leadId },
        data: { leadId: null },
      });

      await tx.task.deleteMany({
        where: {
          entityType: "LEAD",
          entityId: leadId,
        },
      });

      await tx.attachment.deleteMany({
        where: {
          entityType: "LEAD",
          entityId: leadId,
        },
      });

      await tx.lead.delete({ where: { id: leadId } });
    });

    try {
      await appendActivityLog({
        entityType: "LEAD",
        entityId: leadId,
        type: "LEAD_UPDATED",
        actorUserId: user.id,
        data: { action: "LEAD_DELETED" },
      });
    } catch (logError) {
      console.error("[DELETE leads/[leadId]] activity-log failed", logError);
    }

    try {
      revalidatePath("/leads");
      revalidatePath("/leads/new");
      revalidatePath("/leads/no-response");
      revalidatePath("/leads/no-next-step");
      revalidatePath("/leads/overdue");
      revalidatePath("/leads/duplicates");
      revalidatePath("/leads/re-contact");
      revalidatePath("/leads/closed");
      revalidatePath("/leads/converted");
      revalidatePath("/leads/unassigned");
      revalidatePath("/leads/lost");
      revalidatePath("/leads/archived");
      revalidatePath(`/leads/${leadId}`);
    } catch (revalidateError) {
      console.error("[DELETE leads/[leadId]] revalidate failed", revalidateError);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE leads/[leadId]]", e);
    return NextResponse.json({ error: "Не вдалося видалити лід" }, { status: 500 });
  }
}
