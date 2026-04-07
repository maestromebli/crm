import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { getTargetWorkspaceSnapshot } from "../../../../features/target/data/repository";

export const runtime = "nodejs";

/** Повний знімок модуля «Таргет» для інтеграцій та дебагу. Потрібне `REPORTS_VIEW`. */
export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.REPORTS_VIEW);
  if (denied) return denied;

  const snapshot = await getTargetWorkspaceSnapshot();
  return NextResponse.json(snapshot);
}
