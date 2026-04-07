import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { getTargetWorkspaceSnapshot } from "../../../../../features/target/data/repository";
import { buildCampaignsCsv } from "../../../../../features/target/lib/csv";

export const runtime = "nodejs";

/** Експорт таблиці кампаній у CSV (числові колонки — зручно для Excel). */
export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.REPORTS_VIEW);
  if (denied) return denied;

  const snapshot = await getTargetWorkspaceSnapshot();
  const csv = buildCampaignsCsv(snapshot.campaigns);
  const day = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="target-campaigns-${day}.csv"`,
    },
  });
}
