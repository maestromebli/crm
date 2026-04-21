import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  jsonError,
  jsonSuccess,
} from "../../../../../lib/api/http";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { getLeadById } from "../../../../../features/leads/queries";
import { resolveAccessContext } from "../../../../../lib/authz/data-scope";
import {
  mapLeadDetailRowToCoreInput,
  validateLeadConversionToDeal,
} from "../../../../../lib/crm-core";
import { resolveDefaultDealStage } from "../../../../../lib/deals/resolve-default-stage";
import {
  convertLeadToDeal,
  type ConvertLeadToDealInput,
} from "../../../../../lib/leads/convert-lead-to-deal";
import { prisma } from "../../../../../lib/prisma";
import { publishCrmEvent, CRM_EVENT_TYPES } from "@/lib/events/crm-events";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";
import {
  claimIdempotencyKey,
  enforcePolicy,
  getRequestContext,
  readIdempotencyKey,
  writePlatformAudit,
} from "@/lib/platform";
import { logError, logInfo } from "@/lib/observability/logger";

type Ctx = { params: Promise<{ leadId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const requestCtx = getRequestContext(req);
  const requestId = requestCtx.requestId;
  if (!process.env.DATABASE_URL?.trim()) {
    return jsonError(requestId, "DATABASE_URL не задано", 503);
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const dealPermDenied = enforcePolicy(user, P.DEALS_CREATE);
  if (dealPermDenied) return dealPermDenied;

  const { leadId } = await ctx.params;

  let body: ConvertLeadToDealInput = {};
  try {
    body = (await req.json()) as ConvertLeadToDealInput;
  } catch {
    body = {};
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      contact: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          clientId: true,
        },
      },
      client: true,
      deals: {
        where: { status: "OPEN" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true },
      },
      leadContacts: { select: { contactId: true } },
    },
  });

  if (!lead) {
    return jsonError(requestId, "Лід не знайдено", 404);
  }

  const idempotencyKey = readIdempotencyKey(req);
  if (idempotencyKey) {
    const claim = await claimIdempotencyKey({
      key: `lead-convert:${lead.id}:${idempotencyKey}`,
      entityType: "LEAD",
      entityId: lead.id,
      userId: user.id,
      requestId,
    });
    if (!claim.accepted) {
      logInfo({
        module: "api.leads.convert-to-deal",
        message: "Виявлено дубльований ідемпотентний запит",
        requestId: requestCtx.requestId,
        correlationId: requestCtx.correlationId,
        details: { leadId: lead.id, userId: user.id },
      });
      return jsonSuccess(
        requestId,
        {
          alreadyProcessed: true,
          idempotencyEventId: claim.eventId,
        },
        { status: 200 },
      );
    }
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  const existingOpen = lead.deals[0];
  if (existingOpen) {
    return jsonSuccess(requestId, {
      dealId: existingOpen.id,
      alreadyLinked: true,
    });
  }

  const accessCtx = await resolveAccessContext(prisma, user);
  const detail = await getLeadById(leadId, accessCtx);
  if (!detail) {
    return jsonError(requestId, "Лід не знайдено", 404);
  }
  const gate = validateLeadConversionToDeal(mapLeadDetailRowToCoreInput(detail));
  if (!gate.ok) {
    return jsonError(
      requestId,
      gate.errors.map((e) => e.messageUa).join(" · "),
      400,
      { conversionErrors: gate.errors },
    );
  }

  const stage = await resolveDefaultDealStage();
  if (!stage) {
    return jsonError(
      requestId,
      "Немає воронки для замовлень. Виконайте `pnpm db:seed` або створіть Pipeline з entityType DEAL.",
      409,
    );
  }

  const actorId = user.id;

  const ownerFromBody = body.dealSetup?.ownerId?.trim();
  const prodMgrFromBody = body.dealSetup?.productionManagerId?.trim();
  if (ownerFromBody && ownerFromBody !== lead.ownerId) {
    const ou = await prisma.user.findUnique({
      where: { id: ownerFromBody },
      select: { id: true },
    });
    if (!ou) {
      return jsonError(requestId, "Недійсний відповідальний менеджер", 400);
    }
  }
  if (prodMgrFromBody) {
    const pm = await prisma.user.findUnique({
      where: { id: prodMgrFromBody },
      select: { id: true },
    });
    if (!pm) {
      return jsonError(requestId, "Недійсний менеджер виробництва", 400);
    }
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        return convertLeadToDeal(tx, {
          lead: {
            id: lead.id,
            title: lead.title,
            note: lead.note,
            contactName: lead.contactName,
            phone: lead.phone,
            email: lead.email,
            ownerId: lead.ownerId,
            contactId: lead.contactId,
            clientId: lead.clientId,
            contact: lead.contact,
            leadContacts: lead.leadContacts,
            activeProposalId: lead.activeProposalId,
            activeEstimateId: lead.activeEstimateId,
          },
          leadPipelineId: lead.pipelineId,
          input: body,
          actorId,
          dealStage: { pipelineId: stage.pipelineId, stageId: stage.stageId },
        });
      },
      { maxWait: 10_000, timeout: 25_000 },
    );

    await writePlatformAudit({
      entityType: "DEAL",
      entityId: result.deal.id,
      type: "DEAL_CREATED",
      actorUserId: actorId,
      requestId: requestCtx.requestId,
      correlationId: requestCtx.correlationId,
      data: {
        fromLeadId: lead.id,
        title: result.deal.title,
        filesMigratedFromLead: result.filesMigrated,
        estimatesMovedFromLead: result.estimatesMoved,
        contactsLinked: result.contactsLinked,
      },
    });

    await writePlatformAudit({
      entityType: "LEAD",
      entityId: lead.id,
      type: "LEAD_UPDATED",
      actorUserId: actorId,
      requestId: requestCtx.requestId,
      correlationId: requestCtx.correlationId,
      data: { convertedToDealId: result.deal.id },
    });
    await publishCrmEvent({
      type: CRM_EVENT_TYPES.DEAL_CREATED,
      dealId: result.deal.id,
      payload: {
        fromLeadId: lead.id,
      },
      dedupeKey: `deal:created:${result.deal.id}`,
    });
    await recordWorkflowEvent(
      WORKFLOW_EVENT_TYPES.DEAL_CREATED,
      { dealId: result.deal.id, leadId: lead.id },
      {
        entityType: "DEAL",
        entityId: result.deal.id,
        dealId: result.deal.id,
        userId: actorId,
      },
    );

    revalidatePath("/leads");
    revalidatePath("/leads/new");
    revalidatePath("/leads/mine");
    revalidatePath("/leads/lost");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/deals");
    revalidatePath(`/deals/${result.deal.id}/workspace`);
    if (result.deal.primaryContactId) {
      revalidatePath(`/contacts/${result.deal.primaryContactId}`);
    }

    return jsonSuccess(requestId, {
      dealId: result.deal.id,
      alreadyLinked: false,
      filesMigrated: result.filesMigrated,
      estimatesMoved: result.estimatesMoved,
      contactsLinked: result.contactsLinked,
    });
  } catch (e) {
    logError({
      module: "api.leads.convert-to-deal",
      message: "Не вдалося конвертувати лід в замовлення",
      requestId: requestCtx.requestId,
      correlationId: requestCtx.correlationId,
      details: {
        leadId,
        error: e instanceof Error ? e.message : String(e),
      },
    });
    return jsonError(requestId, "Не вдалося створити замовлення", 500);
  }
}
