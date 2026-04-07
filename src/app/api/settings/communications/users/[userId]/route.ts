import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
  type SessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { prisma } from "../../../../../../lib/prisma";
import { settingsUsersListWhere } from "../../../../../../lib/authz/data-scope";
import {
  getUserCommunicationsConfigSafe,
  upsertUserCommunicationsConfig,
} from "../../../../../../lib/settings/communications-settings-store";
import type { CommunicationsIntegrationsConfig } from "../../../../../../lib/settings/communications-config";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ userId: string }> };

async function canAccessTarget(
  sessionUser: SessionUser,
  userId: string,
): Promise<boolean> {
  const where = await settingsUsersListWhere(prisma, sessionUser);
  const target = await prisma.user.findFirst({
    where: {
      AND: [{ id: userId }, ...(where ? [where] : [])],
    },
    select: { id: true },
  });
  return Boolean(target);
}

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.USERS_VIEW);
  if (denied) return denied;

  const { userId } = await ctx.params;
  if (!(await canAccessTarget(user, userId))) {
    return NextResponse.json({ error: "Користувача не знайдено" }, { status: 404 });
  }

  const data = await getUserCommunicationsConfigSafe(userId);
  return NextResponse.json(data);
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.USERS_MANAGE);
  if (denied) return denied;

  const { userId } = await ctx.params;
  if (!(await canAccessTarget(user, userId))) {
    return NextResponse.json({ error: "Користувача не знайдено" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Очікується об'єкт полів" }, { status: 400 });
  }

  const patch = body as Partial<CommunicationsIntegrationsConfig>;
  await upsertUserCommunicationsConfig(userId, patch, user.id);
  const data = await getUserCommunicationsConfigSafe(userId);
  return NextResponse.json({ ok: true, data });
}
