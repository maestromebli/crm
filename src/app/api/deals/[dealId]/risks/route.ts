import { NextResponse } from "next/server";
import { requireDealAccess } from "@/lib/deal-hub-api/access";
import { queryDealHubHealth } from "@/lib/deal-hub-api/queries";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const health = await queryDealHubHealth(dealId);
  const risks = (health?.reasons ?? []).map((reason, index) => ({
    id: `health-${index + 1}`,
    title: reason,
    severity:
      health?.status === "CRITICAL"
        ? "critical"
        : health?.status === "RISK"
          ? "risk"
          : "warning",
  }));
  return NextResponse.json({ ok: true, data: risks });
}
