import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../lib/authz/permissions";
import {
  canAccessOwner,
  resolveAccessContext,
  settingsUsersListWhere,
} from "../../../../lib/authz/data-scope";
import { LEAD_ASSIGNABLE_MANAGER_ROLES } from "../../../../lib/leads/lead-owner-roles";

/**
 * Користувачі, яких можна призначити відповідальним за лід при створенні.
 * З LEADS_ASSIGN — лише ролі менеджера (MANAGER, HEAD_MANAGER, SALES_MANAGER) у межах видимості.
 * Без LEADS_ASSIGN — лише поточний користувач (будь-яка роль).
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

  const permCtx = {
    realRole: sessionUser.realRole,
    impersonatorId: sessionUser.impersonatorId,
  };

  const canAssignOthers = hasEffectivePermission(
    sessionUser.permissionKeys,
    P.LEADS_ASSIGN,
    permCtx,
  );

  try {
    if (!canAssignOthers) {
      const self = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { id: true, name: true, email: true },
      });
      return NextResponse.json({
        assignees: self ? [self] : [],
        canAssignOthers: false,
      });
    }

    const listWhere = await settingsUsersListWhere(prisma, {
      id: sessionUser.id,
      role: sessionUser.dbRole,
    });

    const where =
      listWhere === undefined
        ? { role: { in: LEAD_ASSIGNABLE_MANAGER_ROLES } }
        : { AND: [listWhere, { role: { in: LEAD_ASSIGNABLE_MANAGER_ROLES } }] };

    const rows = await prisma.user.findMany({
      where,
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    });

    const ctx = await resolveAccessContext(prisma, {
      id: sessionUser.id,
      role: sessionUser.dbRole,
    });

    const assignees = rows.filter((u) => canAccessOwner(ctx, u.id));

    return NextResponse.json({
      assignees,
      canAssignOthers: true,
    });
  } catch (e) {
     
    console.error("[GET leads/assignees]", e);
    return NextResponse.json(
      { error: "Помилка завантаження списку" },
      { status: 500 },
    );
  }
}
