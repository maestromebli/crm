import { NextResponse } from "next/server";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { parseEstimatePromptToDraft } from "../../../../../../lib/estimates/ai-estimate-draft";
import { prisma } from "../../../../../../lib/prisma";

type Ctx = { params: Promise<{ leadId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const estDenied = forbidUnlessPermission(user, P.ESTIMATES_CREATE);
  if (estDenied) return estDenied;

  const { leadId } = await ctx.params;
  let body: { prompt?: string };
  try {
    body = (await req.json()) as { prompt?: string };
  } catch {
    body = {};
  }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, dealId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }
  if (lead.dealId) {
    return NextResponse.json(
      { error: "Використовуйте смету в угоді" },
      { status: 409 },
    );
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  const draft = parseEstimatePromptToDraft(prompt);
  return NextResponse.json({ ok: true, draft });
}
