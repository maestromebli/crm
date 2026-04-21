import { NextResponse } from "next/server";
import {
  forbidUnlessDealAccess,
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { requireDatabaseUrl } from "../../../../lib/api/route-guards";
import { prisma } from "../../../../lib/prisma";
import { buildCommunicationHub } from "../../../../features/communication/services/hub-query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId")?.trim() || null;
  const dealId = searchParams.get("dealId")?.trim() || null;

  if ((!leadId && !dealId) || (leadId && dealId)) {
    return NextResponse.json(
      { error: "Вкажіть leadId або dealId" },
      { status: 400 },
    );
  }

  try {
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, ownerId: true },
      });
      if (!lead) {
        return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
      }
      const denied = await forbidUnlessLeadAccess(user, P.LEADS_VIEW, lead);
      if (denied) return denied;
    } else if (dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: { id: true, ownerId: true },
      });
      if (!deal) {
        return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
      }
      const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
      if (denied) return denied;
    }

    const hub = await buildCommunicationHub({ leadId: leadId ?? undefined, dealId: dealId ?? undefined });
    if (!hub) {
      return NextResponse.json({ error: "Немає даних" }, { status: 404 });
    }
    return NextResponse.json(hub);
  } catch (e) {
    console.error("[GET /api/communication/hub]", e);
    return NextResponse.json(
      { error: "Помилка завантаження хаба" },
      { status: 500 },
    );
  }
}
