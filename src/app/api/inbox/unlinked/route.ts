import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { getUnlinkedInbound } from "../../../../lib/messaging/unlinked-inbox-log";
import { normalizeRole } from "../../../../lib/authz/roles";

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.LEADS_VIEW);
  if (denied) return denied;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "60");
  let items = await getUnlinkedInbound(limit);
  const role = normalizeRole(user.dbRole);
  if (role !== "SUPER_ADMIN" && role !== "DIRECTOR" && role !== "HEAD_MANAGER") {
    items = items.filter(
      (x) => !x.ownerUserId || x.ownerUserId === user.id,
    );
  }
  return NextResponse.json({ ok: true, items });
}
