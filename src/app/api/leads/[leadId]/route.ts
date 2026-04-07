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
  mapLeadDetailRowToCoreInput,
  resolveLeadStageKey,
  validateLeadStageTransition,
  type TransitionValidationResult,
} from "../../../../lib/crm-core";
import { prisma } from "../../../../lib/prisma";

const PRIORITIES = new Set(["low", "normal", "high"]);

type Ctx = { params: Promise<{ leadId: string }> };

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

  let stageTransitionForResponse:
    | Pick<TransitionValidationResult, "warnings" | "missingRequirements">
    | undefined;

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

  if (typeof body.stageId === "string" && body.stageId.trim()) {
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: body.stageId.trim(), pipelineId: lead.pipelineId },
    });
    if (!stage) {
      return NextResponse.json(
        { error: "Стадія не належить воронці цього ліда" },
        { status: 400 },
      );
    }
    if (stage.id !== lead.stageId) {
      const detail = await getLeadById(leadId, accessCtx);
      if (!detail) {
        return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
      }
      const fromKey = resolveLeadStageKey(lead.stage.slug, {
        isFinal: lead.stage.isFinal,
        finalType: lead.stage.finalType,
      });
      const toKey = resolveLeadStageKey(stage.slug, {
        isFinal: stage.isFinal,
        finalType: stage.finalType,
      });
      const core = mapLeadDetailRowToCoreInput(detail);
      const tv = validateLeadStageTransition(fromKey, toKey, core);
      if (!tv.ok) {
        return NextResponse.json(
          {
            error: tv.errors.map((e) => e.messageUa).join(" · "),
            transitionErrors: tv.errors,
            transitionWarnings: tv.warnings,
            missingRequirements: tv.missingRequirements,
          },
          { status: 400 },
        );
      }
      stageTransitionForResponse = {
        warnings: tv.warnings,
        missingRequirements: tv.missingRequirements,
      };
      patch.stageId = stage.id;
    }
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

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Немає полів для оновлення" }, {
      status: 400,
    });
  }

  try {
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: patch,
    });

    await ensureContactForLead(prisma, leadId);

    const contactIdAfter =
      (
        await prisma.lead.findUnique({
          where: { id: leadId },
          select: { contactId: true },
        })
      )?.contactId ?? updated.contactId;

    await appendActivityLog({
      entityType: "LEAD",
      entityId: leadId,
      type: "LEAD_UPDATED",
      actorUserId: user.id,
      data: { fields: Object.keys(patch) },
    });

    revalidatePath("/leads");
    revalidatePath("/leads/new");
    revalidatePath("/leads/no-response");
    revalidatePath("/leads/no-next-step");
    revalidatePath("/leads/overdue");
    revalidatePath("/leads/duplicates");
    revalidatePath("/leads/re-contact");
    revalidatePath("/leads/converted");
    revalidatePath("/leads/unassigned");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/contact`);
    revalidatePath(`/leads/${leadId}/activity`);

    return NextResponse.json({
      ok: true,
      ...(stageTransitionForResponse
        ? { stageTransition: stageTransitionForResponse }
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
