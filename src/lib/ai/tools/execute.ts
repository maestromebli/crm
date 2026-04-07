import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import type { SessionUser } from "../../authz/api-guard";
import {
  hasEffectivePermission,
  P,
  type Phase1Permission,
} from "../../authz/permissions";
import {
  calendarEventWhere,
  canAccessOwner,
  ownerIdWhere,
  resolveAccessContext,
} from "../../authz/data-scope";
import { taskListWhereForUser } from "../../tasks/prisma-scope";
import { buildNavSnapshotForAi } from "./nav-for-user";

const CUID_LIKE = /^[a-z0-9]{20,40}$/i;

function permCtx(user: SessionUser) {
  return {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  };
}

function can(
  user: SessionUser,
  key: Phase1Permission,
): boolean {
  return hasEffectivePermission(user.permissionKeys, key, permCtx(user));
}

function clampLimit(raw: unknown, fallback: number, hardMax: number): number {
  let n = fallback;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    n = Math.floor(raw);
  } else if (typeof raw === "string" && raw.trim()) {
    const p = Number.parseInt(raw.trim(), 10);
    if (!Number.isNaN(p)) n = p;
  }
  return Math.min(hardMax, Math.max(1, n || fallback));
}

export async function executeAiTool(
  name: string,
  argsJson: string,
  user: SessionUser,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(argsJson || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      args = parsed as Record<string, unknown>;
    }
  } catch {
    return JSON.stringify({ error: "Некоректні аргументи tool (не JSON)." });
  }

  try {
    switch (name) {
      case "crm_list_leads":
        return JSON.stringify(await toolListLeads(user, args));
      case "crm_list_deals":
        return JSON.stringify(await toolListDeals(user, args));
      case "crm_list_open_tasks":
        return JSON.stringify(await toolListOpenTasks(user, args));
      case "crm_get_lead":
        return JSON.stringify(await toolGetLead(user, args));
      case "crm_get_deal":
        return JSON.stringify(await toolGetDeal(user, args));
      case "crm_quick_overview":
        return JSON.stringify(await toolQuickOverview(user));
      case "crm_nav_menu":
        return JSON.stringify(toolNavMenu(user));
      case "crm_calendar_upcoming":
        return JSON.stringify(await toolCalendarUpcoming(user, args));
      case "crm_search_contacts":
        return JSON.stringify(await toolSearchContacts(user, args));
      default:
        return JSON.stringify({ error: `Невідомий tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({
      error: "Помилка виконання запиту до CRM",
      message: (e as Error).message,
    });
  }
}

async function toolListLeads(
  user: SessionUser,
  args: Record<string, unknown>,
) {
  if (!can(user, P.LEADS_VIEW)) {
    return { error: "Немає права LEADS_VIEW" };
  }

  const limit = clampLimit(args.limit, 15, 25);
  const ctx = await resolveAccessContext(prisma, user);
  const ownerFilter = ownerIdWhere(ctx);

  const where: Prisma.LeadWhereInput = {};
  if (ownerFilter) where.ownerId = ownerFilter;

  const rows = await prisma.lead.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      priority: true,
      nextStep: true,
      nextContactAt: true,
      lastActivityAt: true,
      phone: true,
      email: true,
      contactName: true,
      stage: { select: { name: true, slug: true } },
      pipeline: { select: { name: true } },
      owner: { select: { id: true, name: true, email: true } },
      updatedAt: true,
    },
  });

  return {
    count_returned: rows.length,
    leads: rows.map((r) => ({
      id: r.id,
      title: r.title,
      priority: r.priority,
      stage: r.stage.name,
      pipeline: r.pipeline.name,
      owner: r.owner.name ?? r.owner.email,
      next_step: r.nextStep,
      next_contact_at: r.nextContactAt?.toISOString() ?? null,
      contact_name: r.contactName,
      phone: r.phone,
      email: r.email,
      updated_at: r.updatedAt.toISOString(),
    })),
  };
}

async function toolListDeals(
  user: SessionUser,
  args: Record<string, unknown>,
) {
  if (!can(user, P.DEALS_VIEW)) {
    return { error: "Немає права DEALS_VIEW" };
  }

  const limit = clampLimit(args.limit, 15, 25);
  const ctx = await resolveAccessContext(prisma, user);
  const ownerFilter = ownerIdWhere(ctx);

  const where: Prisma.DealWhereInput = {};
  if (ownerFilter) where.ownerId = ownerFilter;

  const rows = await prisma.deal.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      value: true,
      currency: true,
      expectedCloseDate: true,
      installationDate: true,
      updatedAt: true,
      stage: { select: { name: true, slug: true } },
      pipeline: { select: { name: true } },
      owner: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
      productionFlow: {
        select: { id: true, status: true, createdAt: true },
      },
    },
  });

  return {
    count_returned: rows.length,
    deals: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      stage: r.stage.name,
      pipeline: r.pipeline.name,
      owner: r.owner.name ?? r.owner.email,
      client: r.client.name,
      value: r.value != null ? Number(r.value) : null,
      currency: r.currency,
      expected_close: r.expectedCloseDate?.toISOString() ?? null,
      installation_date: r.installationDate?.toISOString() ?? null,
      production: r.productionFlow
        ? {
            status: r.productionFlow.status,
            launched_at: r.productionFlow.createdAt.toISOString(),
            queued_at: r.productionFlow.createdAt.toISOString(),
          }
        : null,
      updated_at: r.updatedAt.toISOString(),
    })),
  };
}

async function toolListOpenTasks(
  user: SessionUser,
  args: Record<string, unknown>,
) {
  if (!can(user, P.TASKS_VIEW)) {
    return { error: "Немає права TASKS_VIEW" };
  }

  const limit = clampLimit(args.limit, 20, 25);
  const scopeWhere = await taskListWhereForUser(prisma, user);

  const rows = await prisma.task.findMany({
    where: {
      AND: [
        scopeWhere,
        { status: { in: ["OPEN", "IN_PROGRESS"] } },
      ],
    },
    take: limit,
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      taskType: true,
      entityType: true,
      entityId: true,
      dueAt: true,
      assignee: { select: { name: true, email: true } },
    },
  });

  return {
    count_returned: rows.length,
    tasks: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      task_type: r.taskType,
      entity: `${r.entityType}:${r.entityId}`,
      due_at: r.dueAt?.toISOString() ?? null,
      assignee: r.assignee.name ?? r.assignee.email,
    })),
  };
}

async function toolGetLead(
  user: SessionUser,
  args: Record<string, unknown>,
) {
  if (!can(user, P.LEADS_VIEW)) {
    return { error: "Немає права LEADS_VIEW" };
  }

  const leadId = typeof args.lead_id === "string" ? args.lead_id.trim() : "";
  if (!leadId || !CUID_LIKE.test(leadId)) {
    return { error: "Некоректний lead_id" };
  }

  const ctx = await resolveAccessContext(prisma, user);

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      stage: { select: { name: true, slug: true } },
      pipeline: { select: { name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  if (!lead) {
    return { error: "Лід не знайдено" };
  }
  if (!canAccessOwner(ctx, lead.ownerId)) {
    return { error: "Недостатньо прав або лід поза вашою видимістю" };
  }

  return {
    id: lead.id,
    title: lead.title,
    source: lead.source,
    priority: lead.priority,
    stage: lead.stage.name,
    pipeline: lead.pipeline.name,
    owner: lead.owner.name ?? lead.owner.email,
    contact_name: lead.contactName,
    phone: lead.phone,
    email: lead.email,
    note: lead.note,
    next_step: lead.nextStep,
    next_contact_at: lead.nextContactAt?.toISOString() ?? null,
    last_activity_at: lead.lastActivityAt?.toISOString() ?? null,
    updated_at: lead.updatedAt.toISOString(),
  };
}

async function toolGetDeal(
  user: SessionUser,
  args: Record<string, unknown>,
) {
  if (!can(user, P.DEALS_VIEW)) {
    return { error: "Немає права DEALS_VIEW" };
  }

  const dealId = typeof args.deal_id === "string" ? args.deal_id.trim() : "";
  if (!dealId || !CUID_LIKE.test(dealId)) {
    return { error: "Некоректний deal_id" };
  }

  const ctx = await resolveAccessContext(prisma, user);

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      stage: { select: { name: true, slug: true } },
      pipeline: { select: { name: true } },
      owner: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
      productionFlow: {
        select: { id: true, status: true, createdAt: true },
      },
      productionManager: { select: { name: true, email: true } },
    },
  });

  if (!deal) {
    return { error: "Угоду не знайдено" };
  }
  if (!canAccessOwner(ctx, deal.ownerId)) {
    return { error: "Недостатньо прав або угода поза вашою видимістю" };
  }

  return {
    id: deal.id,
    title: deal.title,
    description: deal.description,
    status: deal.status,
    stage: deal.stage.name,
    pipeline: deal.pipeline.name,
    owner: deal.owner.name ?? deal.owner.email,
    client: deal.client.name,
    value: deal.value != null ? Number(deal.value) : null,
    currency: deal.currency,
    expected_close: deal.expectedCloseDate?.toISOString() ?? null,
    installation_date: deal.installationDate?.toISOString() ?? null,
    production_manager:
      deal.productionManager?.name ?? deal.productionManager?.email ?? null,
    production: deal.productionFlow
      ? {
          status: deal.productionFlow.status,
          launched_at: deal.productionFlow.createdAt.toISOString(),
          queued_at: deal.productionFlow.createdAt.toISOString(),
          error: null,
        }
      : null,
    updated_at: deal.updatedAt.toISOString(),
  };
}

async function toolQuickOverview(user: SessionUser) {
  const ctx = await resolveAccessContext(prisma, user);
  const ownerFilter = ownerIdWhere(ctx);

  const leadWhere: Prisma.LeadWhereInput = {};
  if (ownerFilter) leadWhere.ownerId = ownerFilter;

  const dealWhere: Prisma.DealWhereInput = {};
  if (ownerFilter) dealWhere.ownerId = ownerFilter;

  const taskScope = await taskListWhereForUser(prisma, user);
  const taskOpenWhere: Prisma.TaskWhereInput = {
    AND: [
      taskScope,
      { status: { in: ["OPEN", "IN_PROGRESS"] } },
    ],
  };

  const [leads, deals, openTasks] = await Promise.all([
    can(user, P.LEADS_VIEW)
      ? prisma.lead.count({ where: leadWhere })
      : Promise.resolve(null),
    can(user, P.DEALS_VIEW)
      ? prisma.deal.count({ where: dealWhere })
      : Promise.resolve(null),
    can(user, P.TASKS_VIEW)
      ? prisma.task.count({ where: taskOpenWhere })
      : Promise.resolve(null),
  ]);

  return {
    scope: ownerFilter ? "team_or_self" : "organization",
    counts: {
      leads,
      deals: deals,
      open_tasks: openTasks,
    },
    note: "null у лічильнику означає, що модуль недоступний за правами користувача.",
  };
}

function toolNavMenu(user: SessionUser) {
  return buildNavSnapshotForAi(user);
}

async function toolCalendarUpcoming(
  user: SessionUser,
  args: Record<string, unknown>,
) {
  if (!can(user, P.CALENDAR_VIEW)) {
    return { error: "Немає права CALENDAR_VIEW" };
  }

  const limit = clampLimit(args.limit, 12, 20);
  const ctx = await resolveAccessContext(prisma, user);
  const scope = calendarEventWhere(ctx);
  const now = new Date();

  const where: Prisma.CalendarEventWhereInput = {
    AND: [
      ...(scope ? [scope] : []),
      { startAt: { gte: now } },
      { status: { not: "CANCELED" } },
    ],
  };

  const rows = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startAt: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      startAt: true,
      endAt: true,
      location: true,
      assignedTo: { select: { name: true, email: true } },
    },
  });

  return {
    count_returned: rows.length,
    events: rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      status: r.status,
      start_at: r.startAt.toISOString(),
      end_at: r.endAt.toISOString(),
      location: r.location,
      assignee: r.assignedTo?.name ?? r.assignedTo?.email ?? null,
    })),
  };
}

async function toolSearchContacts(
  user: SessionUser,
  args: Record<string, unknown>,
) {
  if (!can(user, P.CONTACTS_VIEW)) {
    return { error: "Немає права CONTACTS_VIEW" };
  }

  const q =
    typeof args.query === "string" ? args.query.trim() : "";
  if (q.length < 2) {
    return { error: "Вкажіть query не коротше 2 символів" };
  }

  const limit = clampLimit(args.limit, 10, 15);
  const access = await resolveAccessContext(prisma, user);
  const ownerWhere = ownerIdWhere(access);

  const rows = await prisma.contact.findMany({
    where: {
      AND: [
        {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        ...(ownerWhere
          ? [
              {
                OR: [
                  { leads: { some: { ownerId: ownerWhere } } },
                  { deals: { some: { ownerId: ownerWhere } } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  });

  return {
    count_returned: rows.length,
    contacts: rows.map((r) => ({
      id: r.id,
      full_name: r.fullName,
      phone: r.phone,
      email: r.email,
    })),
  };
}
