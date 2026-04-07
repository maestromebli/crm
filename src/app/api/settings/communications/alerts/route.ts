import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { settingsUsersListWhere } from "../../../../../lib/authz/data-scope";
import { P } from "../../../../../lib/authz/permissions";
import {
  acknowledgeAllCommunicationsAlerts,
  acknowledgeCommunicationsAlert,
  listCommunicationsAlerts,
} from "../../../../../lib/messaging/communications-health";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

async function visibleUserIds(user: { id: string; role: string }) {
  const where = await settingsUsersListWhere(prisma, user);
  const users = await prisma.user.findMany({
    where,
    select: { id: true },
    take: 500,
  });
  return users.map((u) => u.id);
}

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.NOTIFICATIONS_VIEW);
  if (denied) return denied;

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "1";
  const ids = await visibleUserIds(user);
  const items = await listCommunicationsAlerts({
    userIds: ids,
    unreadOnly,
  });
  return NextResponse.json({ ok: true, items: items.slice(0, 200) });
}

export async function PATCH(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.NOTIFICATIONS_VIEW);
  if (denied) return denied;

  let body: { id?: string; ackAll?: boolean; unreadOnly?: boolean };
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const ids = await visibleUserIds(user);
  if (body.ackAll) {
    const count = await acknowledgeAllCommunicationsAlerts({
      actorUserId: user.id,
      allowedUserIds: ids,
      unreadOnly: body.unreadOnly !== false,
    });
    return NextResponse.json({ ok: true, count });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id обовʼязковий" }, { status: 400 });
  }

  const ok = await acknowledgeCommunicationsAlert({
    id,
    actorUserId: user.id,
    allowedUserIds: ids,
  });
  if (!ok) {
    return NextResponse.json({ error: "Alert не знайдено" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
