import { NextResponse } from "next/server";
import { requireDealAccess } from "@/lib/deal-hub-api/access";
import { queryDealHubHealth } from "@/lib/deal-hub-api/queries";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const стан = await queryDealHubHealth(dealId);
  const risks = (стан?.reasons ?? []).map((reason, index) => ({
    id: `стан-${index + 1}`,
    title: reason,
    severity:
      стан?.status === "CRITICAL"
        ? "critical"
        : стан?.status === "RISK"
          ? "risk"
          : "warning",
  }));
  return NextResponse.json({ ok: true, data: risks });
}
