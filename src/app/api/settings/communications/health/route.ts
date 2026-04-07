import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { settingsUsersListWhere } from "../../../../../lib/authz/data-scope";
import { P } from "../../../../../lib/authz/permissions";
import {
  buildWeeklyDigest,
  getCommunicationsHealth,
  getCommunicationsHealthPolicy,
  setCommunicationsHealthPolicy,
} from "../../../../../lib/messaging/communications-health";
import { prisma } from "../../../../../lib/prisma";
import { getEffectiveCommunicationsConfigForUser } from "../../../../../lib/settings/communications-settings-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const url = new URL(req.url);
  const selectedUserId = url.searchParams.get("userId")?.trim() || null;
  const where = await settingsUsersListWhere(prisma, user);
  const users = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const allowed = new Set(users.map((u) => u.id));
  const effectiveUserId =
    selectedUserId && allowed.has(selectedUserId)
      ? selectedUserId
      : users[0]?.id ?? user.id;

  const health = await getCommunicationsHealth();
  const policy = await getCommunicationsHealthPolicy();
  const digest = buildWeeklyDigest({ health, policy, users });
  return NextResponse.json({
    ok: true,
    users,
    selectedUserId: effectiveUserId,
    channels: health[effectiveUserId] ?? {},
    policy,
    digest,
  });
}

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  let body: {
    userId?: string;
    action?: "check" | "policy";
    deliveryFailAlertThreshold?: number;
    outboundFailAlertThreshold?: number;
  };
  try {
    body = (await req.json()) as { userId?: string };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  if (body.action === "policy") {
    const deniedManage = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
    if (deniedManage) return deniedManage;
    const policy = await setCommunicationsHealthPolicy({
      deliveryFailAlertThreshold: body.deliveryFailAlertThreshold,
      outboundFailAlertThreshold: body.outboundFailAlertThreshold,
    });
    return NextResponse.json({ ok: true, policy });
  }

  const targetUserId =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : user.id;
  const where = await settingsUsersListWhere(prisma, user);
  const target = await prisma.user.findFirst({
    where: { AND: [{ id: targetUserId }, ...(where ? [where] : [])] },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Користувача не знайдено" }, { status: 404 });
  }

  const cfg = await getEffectiveCommunicationsConfigForUser(target.id);
  const channels = cfg.channels ?? {};
  const checks = {
    telegram: {
      enabled: Boolean(channels.telegram?.enabled),
      ready: Boolean(channels.telegram?.enabled && channels.telegram.botToken?.trim()),
      missing: [
        ...(channels.telegram?.botToken?.trim() ? [] : ["botToken"]),
      ],
    },
    whatsapp: {
      enabled: Boolean(channels.whatsapp?.enabled),
      ready: Boolean(
        channels.whatsapp?.enabled &&
          channels.whatsapp.accessToken?.trim() &&
          channels.whatsapp.phoneNumberId?.trim(),
      ),
      missing: [
        ...(channels.whatsapp?.accessToken?.trim() ? [] : ["accessToken"]),
        ...(channels.whatsapp?.phoneNumberId?.trim() ? [] : ["phoneNumberId"]),
      ],
    },
    viber: {
      enabled: Boolean(channels.viber?.enabled),
      ready: Boolean(channels.viber?.enabled && channels.viber.authToken?.trim()),
      missing: [
        ...(channels.viber?.authToken?.trim() ? [] : ["authToken"]),
      ],
    },
    sms: {
      enabled: Boolean(channels.sms?.enabled),
      ready: Boolean(channels.sms?.enabled && channels.sms.provider?.trim()),
      missing: [...(channels.sms?.provider?.trim() ? [] : ["provider"])],
    },
    phone: {
      enabled: Boolean(channels.phone?.enabled),
      ready: Boolean(channels.phone?.enabled && channels.phone.provider?.trim()),
      missing: [...(channels.phone?.provider?.trim() ? [] : ["provider"])],
    },
  };

  return NextResponse.json({ ok: true, checks });
}
