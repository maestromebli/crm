import { NextResponse } from "next/server";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import {
  convertLeadHubToDeal,
  getLeadHubSession,
} from "@/lib/leads/ultra-api";

type Ctx = {
  params: Promise<{ id: string }>;
};

/**
 * @deprecated Legacy lead-hub endpoint.
 * Canonical lead flow is `Lead -> Estimate -> Deal` under `/api/leads/*`.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_VIEW);
  if (denied) return denied;

  const { id } = await ctx.params;
  const session = await getLeadHubSession(id, user);
  if (!session) {
    return NextResponse.json({ error: "Сесію lead hub не знайдено" }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.DEALS_CREATE);
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    action?: "convert";
    pipelineId?: string;
    stageId?: string;
    clientId?: string;
    dealTitle?: string;
  };

  if (body.action !== "convert") {
    return NextResponse.json({ error: "Непідтримувана дія" }, { status: 400 });
  }

  if (!body.pipelineId || !body.stageId || !body.clientId) {
    return NextResponse.json(
      { error: "Для конвертації потрібні pipelineId, stageId і clientId" },
      { status: 400 },
    );
  }

  const deal = await convertLeadHubToDeal({
    sessionId: id,
    pipelineId: body.pipelineId,
    stageId: body.stageId,
    clientId: body.clientId,
    ownerId: user.id,
    dealTitle: body.dealTitle,
  });

  return NextResponse.json({ ok: true, dealId: deal.id });
}
