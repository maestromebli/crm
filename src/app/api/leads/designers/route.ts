import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import {
  canAccessOwner,
  resolveAccessContext,
  settingsUsersListWhere,
} from "@/lib/authz/data-scope";

/**
 * Список дизайнерів для джерела "Дизайнер" у формі створення ліда.
 * Поки що використовуємо видимий список користувачів у рамках data-scope.
 */
export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const sessionUser = await requireSessionUser();
  if (sessionUser instanceof NextResponse) return sessionUser;

  const denied = forbidUnlessPermission(sessionUser, P.LEADS_CREATE);
  if (denied) return denied;

  try {
    const listWhere = await settingsUsersListWhere(prisma, {
      id: sessionUser.id,
      role: sessionUser.dbRole,
    });
    const rows = await prisma.user.findMany({
      ...(listWhere ? { where: listWhere } : {}),
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    });

    const accessCtx = await resolveAccessContext(prisma, {
      id: sessionUser.id,
      role: sessionUser.dbRole,
    });
    const designers = rows.filter((u) => canAccessOwner(accessCtx, u.id));

    return NextResponse.json({ designers });
  } catch (e) {
    console.error("[GET leads/designers]", e);
    return NextResponse.json(
      { error: "Помилка завантаження дизайнерів" },
      { status: 500 },
    );
  }
}
