import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canViewProduction } from "@/features/production/server/permissions/production-permissions";
import { getProductionCommandCenterView } from "@/features/production/server/services/production-command-center.service";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const data = await getProductionCommandCenterView();
  return NextResponse.json(data);
}
