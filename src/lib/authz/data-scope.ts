import {
  CalendarEventStatus,
  CalendarEventType,
  type Prisma,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { normalizeRole } from "./roles";

/** Мінімальні поля для scope (без циклічного імпорту з api-guard). */
export type ScopeUser = { id: string; role: string };

/** Базові ролі менеджерів продажу (цільова видимість для HEAD_MANAGER). */
const SALES_TEAM_ROLES = ["SALES_MANAGER", "USER"] as const;

export type AccessContext = {
  /** `null` — без обмеження по owner (SUPER_ADMIN, DIRECTOR). */
  teamOwnerIdSet: Set<string> | null;
  /** `null` — звичайна фільтрація по ownerId; інакше лише ці ліди (замірник). */
  measurerLeadIds: Set<string> | null;
};

/**
 * Контекст видимості лідів/угод/задач за власником сутності.
 */
export async function resolveAccessContext(
  prisma: PrismaClient,
  user: ScopeUser,
): Promise<AccessContext> {
  const role = normalizeRole(user.role);

  if (role === "SUPER_ADMIN" || role === "DIRECTOR") {
    return { teamOwnerIdSet: null, measurerLeadIds: null };
  }

  if (role === "MEASURER") {
    const events = await prisma.calendarEvent.findMany({
      where: {
        assignedToId: user.id,
        type: CalendarEventType.MEASUREMENT,
        status: { not: CalendarEventStatus.CANCELED },
        leadId: { not: null },
      },
      select: { leadId: true },
    });
    const leadIds = events
      .map((e) => e.leadId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    return {
      teamOwnerIdSet: new Set([user.id]),
      measurerLeadIds: new Set(leadIds),
    };
  }

  if (role === "HEAD_MANAGER" || role === "TEAM_LEAD") {
    const rows = await prisma.user.findMany({
      where: {
        headManagerId: user.id,
        role: { in: [...SALES_TEAM_ROLES] },
      },
      select: { id: true },
    });
    const teamOwnerIdSet = new Set(rows.map((r) => r.id));
    teamOwnerIdSet.add(user.id);
    // Backward-compat: if org hasn't migrated `headManagerId` yet, keep self-only scope.
    return { teamOwnerIdSet, measurerLeadIds: null };
  }

  return {
    teamOwnerIdSet: new Set([user.id]),
    measurerLeadIds: null,
  };
}

export function canAccessOwner(
  ctx: AccessContext,
  ownerId: string,
): boolean {
  if (ctx.teamOwnerIdSet === null) return true;
  return ctx.teamOwnerIdSet.has(ownerId);
}

/** Доступ до ліда: scope власника або список лідів замірника. */
export function canAccessLead(
  ctx: AccessContext,
  lead: { id: string; ownerId: string },
): boolean {
  if (ctx.measurerLeadIds !== null) {
    return ctx.measurerLeadIds.has(lead.id);
  }
  return canAccessOwner(ctx, lead.ownerId);
}

/**
 * Фільтр для Lead: власник у scope або явний список (замірник).
 */
export function leadWhereForAccess(
  ctx: AccessContext,
): Prisma.LeadWhereInput | undefined {
  if (ctx.measurerLeadIds !== null) {
    const ids = [...ctx.measurerLeadIds];
    if (ids.length === 0) {
      return { id: { in: [] } };
    }
    return { id: { in: ids } };
  }
  const ow = ownerIdWhere(ctx);
  return ow ? { ownerId: ow } : undefined;
}

/** Фільтр для Lead.findMany / Deal.findMany за ownerId. */
export function ownerIdWhere(
  ctx: AccessContext,
): Prisma.StringFilter | undefined {
  if (ctx.teamOwnerIdSet === null) return undefined;
  return { in: [...ctx.teamOwnerIdSet] };
}

/**
 * Хто потрапляє в список користувачів у налаштуваннях.
 * SUPER_ADMIN / DIRECTOR — усі; HEAD_MANAGER — менеджери продажів + себе; інакше — лише себе.
 */
export async function settingsUsersListWhere(
  prisma: PrismaClient,
  user: ScopeUser,
): Promise<Prisma.UserWhereInput | undefined> {
  const role = normalizeRole(user.role);
  if (role === "SUPER_ADMIN" || role === "DIRECTOR") {
    return undefined;
  }
  if (role === "HEAD_MANAGER") {
    const rows = await prisma.user.findMany({
      where: {
        headManagerId: user.id,
        role: { in: [...SALES_TEAM_ROLES] },
      },
      select: { id: true },
    });
    const teamIds = rows.map((r) => r.id);
    return {
      OR: [
        { id: { in: teamIds } },
        { id: user.id },
      ],
    };
  }
  return { id: user.id };
}

/** Чи можна змінювати подію (узгоджено з calendarEventWhere). */
export function canAccessCalendarEvent(
  ctx: AccessContext,
  row: {
    createdById: string;
    assignedToId: string | null;
    lead: { ownerId: string } | null;
  },
): boolean {
  if (ctx.teamOwnerIdSet === null) return true;
  const s = ctx.teamOwnerIdSet;
  if (s.has(row.createdById)) return true;
  if (row.assignedToId && s.has(row.assignedToId)) return true;
  if (row.lead && s.has(row.lead.ownerId)) return true;
  return false;
}

/** Фільтр подій календаря: учасники у «команді» видимості або лід команди. */
export function calendarEventWhere(
  ctx: AccessContext,
): Prisma.CalendarEventWhereInput | undefined {
  if (ctx.teamOwnerIdSet === null) return undefined;
  const ids = [...ctx.teamOwnerIdSet];
  return {
    OR: [
      { createdById: { in: ids } },
      { assignedToId: { in: ids } },
      { lead: { is: { ownerId: { in: ids } } } },
    ],
  };
}
