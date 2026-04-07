import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { settingsUsersListWhere } from "@/lib/authz/data-scope";
import { canViewProduction } from "@/features/production/server/permissions/production-permissions";

/**
 * Користувачі, яких можна призначити збірником на задачі цеху (межі видимості як у списку користувачів).
 */
export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const listWhere = await settingsUsersListWhere(prisma, {
    id: user.id,
    role: user.dbRole,
  });

  const users = await prisma.user.findMany({
    where: listWhere ?? {},
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ users });
}
