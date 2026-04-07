import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { settingsUsersListWhere } from "../../../../../../lib/authz/data-scope";

type Ctx = { params: Promise<{ dealId: string }> };

/**
 * Користувачі, яких можна призначити внутрішнім конструктором у кімнаті (межі видимості як у налаштуваннях користувачів).
 */
export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const sessionUser = await requireSessionUser();
  if (sessionUser instanceof NextResponse) return sessionUser;

  const { dealId } = await ctx.params;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(sessionUser, P.PRODUCTION_LAUNCH, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const listWhere = await settingsUsersListWhere(prisma, {
      id: sessionUser.id,
      role: sessionUser.dbRole,
    });

    const users = await prisma.user.findMany({
      where: listWhere ?? {},
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ users });
  } catch (e) {
    console.error("[GET constructor-room/assignees]", e);
    return NextResponse.json(
      { error: "Помилка завантаження списку" },
      { status: 500 },
    );
  }
}
