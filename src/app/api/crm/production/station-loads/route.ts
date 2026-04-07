import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canViewProduction } from "@/features/production/server/permissions/production-permissions";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const loads = await prisma.productionStationLoad.findMany({
    orderBy: [{ stationKey: "asc" }, { loadPercent: "desc" }],
  });
  return NextResponse.json({
    stationLoads: loads.map((load) => ({
      id: load.id,
      flowId: load.flowId,
      stationKey: load.stationKey,
      stationLabel: load.stationLabel,
      loadPercent: load.loadPercent,
    })),
  });
}
