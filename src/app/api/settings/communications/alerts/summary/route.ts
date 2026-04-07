import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { settingsUsersListWhere } from "../../../../../../lib/authz/data-scope";
import { P } from "../../../../../../lib/authz/permissions";
import { listCommunicationsAlerts } from "../../../../../../lib/messaging/communications-health";
import { prisma } from "../../../../../../lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.NOTIFICATIONS_VIEW);
  if (denied) return denied;

  const where = await settingsUsersListWhere(prisma, user);
  const users = await prisma.user.findMany({
    where,
    select: { id: true },
    take: 500,
  });
  const unread = await listCommunicationsAlerts({
    userIds: users.map((u) => u.id),
    unreadOnly: true,
  });
  return NextResponse.json({ ok: true, unreadCount: unread.length });
}
