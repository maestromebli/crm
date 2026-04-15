import { NextResponse } from "next/server";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { updatePricingFromState } from "@/lib/leads/ultra-api";

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.ESTIMATES_UPDATE);
  if (denied) return denied;

  const body = (await req.json()) as {
    pricingSessionId?: string;
    summaryNote?: string;
    items?: Array<{
      id: string;
      name: string;
      quantity: number;
      unitCost: number;
      unitPrice: number;
      category?: string;
      note?: string;
    }>;
  };

  if (!body.pricingSessionId || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "Потрібно передати pricingSessionId і items" },
      { status: 400 },
    );
  }

  const updated = await updatePricingFromState({
    pricingSessionId: body.pricingSessionId,
    items: body.items,
    summaryNote: body.summaryNote,
  });

  return NextResponse.json({
    ok: true,
    versionId: updated.id,
    versionNumber: updated.versionNumber,
  });
}
