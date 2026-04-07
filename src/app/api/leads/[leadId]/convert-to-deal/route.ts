import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  getOrCreateRequestId,
  jsonError,
  jsonSuccess,
} from "../../../../../lib/api/http";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
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

type Ctx = { params: Promise<{ leadId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const requestId = getOrCreateRequestId(req);
  if (!process.env.DATABASE_URL?.trim()) {
    return jsonError(requestId, "DATABASE_URL не задано", 503);
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const dealPermDenied = forbidUnlessPermission(user, P.DEALS_CREATE);
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
      "Немає воронки для угод. Виконайте `pnpm db:seed` або створіть Pipeline з entityType DEAL.",
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

    await appendActivityLog({
      entityType: "DEAL",
      entityId: result.deal.id,
      type: "DEAL_CREATED",
      actorUserId: actorId,
      data: {
        fromLeadId: lead.id,
        title: result.deal.title,
        filesMigratedFromLead: result.filesMigrated,
        estimatesMovedFromLead: result.estimatesMoved,
        contactsLinked: result.contactsLinked,
      },
    });

    await appendActivityLog({
      entityType: "LEAD",
      entityId: lead.id,
      type: "LEAD_UPDATED",
      actorUserId: actorId,
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
    console.error("[POST convert-to-deal]", e);
    return jsonError(requestId, "Не вдалося створити угоду", 500);
  }
}
