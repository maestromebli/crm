import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canViewProduction } from "@/features/production/server/permissions/production-permissions";
import { getProductionOrderHubView } from "@/features/production/server/services/production-order-hub.service";

type Ctx = { params: Promise<{ flowId: string }> };

export async function GET(_request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const { flowId } = await context.params;
  const flow = await getProductionOrderHubView(flowId);
  if (!flow) return NextResponse.json({ error: "Потік не знайдено" }, { status: 404 });
  return NextResponse.json(flow);
}
