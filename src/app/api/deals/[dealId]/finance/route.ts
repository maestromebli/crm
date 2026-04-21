import { NextResponse } from "next/server";
import { requireDealAccess } from "@/lib/deal-hub-api/access";
import { mapEffectiveRoleToDealHubRole } from "@/lib/deal-hub-api/permissions";
import { queryDealHubOverview } from "@/lib/deal-hub-api/queries";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const overview = await queryDealHubOverview(
    dealId,
    mapEffectiveRoleToDealHubRole(access.user.dbRole),
  );
  if (!overview) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    data: {
      pricing: overview.pricing,
      finance: overview.finance,
      health: overview.health,
    },
  });
}
