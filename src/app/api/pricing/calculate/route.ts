import { NextResponse } from "next/server";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { recalculatePricingSession } from "@/lib/leads/ultra-api";

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.ESTIMATES_UPDATE);
  if (denied) return denied;

  const body = (await req.json()) as { pricingSessionId?: string };
  if (!body.pricingSessionId) {
    return NextResponse.json({ error: "Потрібно передати pricingSessionId" }, { status: 400 });
  }

  const version = await recalculatePricingSession(body.pricingSessionId);
  if (!version) {
    return NextResponse.json({ error: "Активну версію ціноутворення не знайдено" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    versionId: version.id,
    versionNumber: version.versionNumber,
  });
}
