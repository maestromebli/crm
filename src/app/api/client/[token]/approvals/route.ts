import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyClientPortalToken } from "@/lib/client-portal/token";
import { publishCrmEvent, CRM_EVENT_TYPES } from "@/lib/events/crm-events";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const payload = verifyClientPortalToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const o =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  if (!o) return NextResponse.json({ error: "Очікується об'єкт" }, { status: 400 });

  const action = typeof o.action === "string" ? o.action : "";
  if (!["approve_quote", "approve_changes"].includes(action)) {
    return NextResponse.json({ error: "Unknown approval action" }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({
    where: { id: payload.dealId },
    select: { id: true, workspaceMeta: true },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const meta =
    deal.workspaceMeta && typeof deal.workspaceMeta === "object" && !Array.isArray(deal.workspaceMeta)
      ? (deal.workspaceMeta as Record<string, unknown>)
      : {};
  const executionChecklist =
    meta.executionChecklist &&
    typeof meta.executionChecklist === "object" &&
    !Array.isArray(meta.executionChecklist)
      ? (meta.executionChecklist as Record<string, unknown>)
      : {};

  await prisma.deal.update({
    where: { id: deal.id },
    data: {
      workspaceMeta: {
        ...meta,
        executionChecklist: {
          ...executionChecklist,
          estimateApproved: true,
        },
      },
    },
  });

  await publishCrmEvent({
    type: CRM_EVENT_TYPES.QUOTE_APPROVED,
    dealId: deal.id,
    payload: { source: "client.portal", action },
  });

  return NextResponse.json({ ok: true });
}
