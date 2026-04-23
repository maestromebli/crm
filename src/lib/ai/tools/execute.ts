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
import { redactContextForAi } from "../context-denylist";

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
    const toToolJson = (value: unknown) =>
      JSON.stringify(redactContextForAi(value));
    switch (name) {
      case "crm_full_context":
        return toToolJson(await toolFullContext(user, args));
      case "crm_list_leads":
        return toToolJson(await toolListLeads(user, args));
      case "crm_list_deals":
        return toToolJson(await toolListDeals(user, args));
      case "crm_list_open_tasks":
        return toToolJson(await toolListOpenTasks(user, args));
      case "crm_get_lead":
        return toToolJson(await toolGetLead(user, args));
      case "crm_get_deal":
        return toToolJson(await toolGetDeal(user, args));
      case "crm_quick_overview":
        return toToolJson(await toolQuickOverview(user));
      case "crm_nav_menu":
        return toToolJson(toolNavMenu(user));
      case "crm_calendar_upcoming":
        return toToolJson(await toolCalendarUpcoming(user, args));
      case "crm_search_contacts":
        return toToolJson(await toolSearchContacts(user, args));
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

async function toolFullContext(
  user: SessionUser,
  args: Record<string, unknown>,
) {
  const limit = clampLimit(args.limit, 8, 20);
  const ctx = await resolveAccessContext(prisma, user);
  const ownerFilter = ownerIdWhere(ctx);
  const dealScope: Prisma.DealWhereInput = ownerFilter
    ? { ownerId: ownerFilter }
    : {};

  const canLeads = can(user, P.LEADS_VIEW);
  const canDeals = can(user, P.DEALS_VIEW);
  const canTasks = can(user, P.TASKS_VIEW);
  const canCalendar = can(user, P.CALENDAR_VIEW);
  const canContacts = can(user, P.CONTACTS_VIEW);
  const canFinance = can(user, P.PAYMENTS_VIEW) || can(user, P.COST_VIEW);
  const canProduction =
    can(user, P.PRODUCTION_ORDERS_VIEW) ||
    can(user, P.PRODUCTION_ORCHESTRATION_VIEW) ||
    canDeals;

  const taskScope = canTasks ? await taskListWhereForUser(prisma, user) : null;
  const calendarScope = canCalendar ? calendarEventWhere(ctx) : null;

  const [
    leadsCount,
    recentLeads,
    dealsCount,
    recentDeals,
    openTasksCount,
    recentTasks,
    contactsCount,
    recentContacts,
    upcomingCalendarCount,
    upcomingCalendarEvents,
    invoicesCount,
    recentInvoices,
    financeTxCount,
    recentFinanceTx,
    procurementCount,
    recentProcurement,
    purchaseOrdersCount,
    recentPurchaseOrders,
    productionFlowsCount,
    recentProductionFlows,
  ] = await Promise.all([
    canLeads ? prisma.lead.count({ where: ownerFilter ? { ownerId: ownerFilter } : {} }) : Promise.resolve(null),
    canLeads
      ? prisma.lead.findMany({
          where: ownerFilter ? { ownerId: ownerFilter } : {},
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            priority: true,
            updatedAt: true,
            stage: { select: { name: true } },
            owner: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    canDeals ? prisma.deal.count({ where: dealScope }) : Promise.resolve(null),
    canDeals
      ? prisma.deal.findMany({
          where: dealScope,
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            status: true,
            value: true,
            currency: true,
            updatedAt: true,
            stage: { select: { name: true } },
            client: { select: { name: true } },
            owner: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    canTasks && taskScope
      ? prisma.task.count({
          where: {
            AND: [taskScope, { status: { in: ["OPEN", "IN_PROGRESS"] } }],
          },
        })
      : Promise.resolve(null),
    canTasks && taskScope
      ? prisma.task.findMany({
          where: {
            AND: [taskScope, { status: { in: ["OPEN", "IN_PROGRESS"] } }],
          },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
          take: limit,
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
        })
      : Promise.resolve([]),
    canContacts
      ? prisma.contact.count({
          where: ownerFilter
            ? {
                OR: [
                  { leads: { some: { ownerId: ownerFilter } } },
                  { deals: { some: { ownerId: ownerFilter } } },
                ],
              }
            : undefined,
        })
      : Promise.resolve(null),
    canContacts
      ? prisma.contact.findMany({
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            updatedAt: true,
          },
          where: ownerFilter
            ? {
                OR: [
                  { leads: { some: { ownerId: ownerFilter } } },
                  { deals: { some: { ownerId: ownerFilter } } },
                ],
              }
            : undefined,
        })
      : Promise.resolve([]),
    canCalendar
      ? prisma.calendarEvent.count({
          where: {
            AND: [
              ...(calendarScope ? [calendarScope] : []),
              { startAt: { gte: new Date() } },
              { status: { not: "CANCELED" } },
            ],
          },
        })
      : Promise.resolve(null),
    canCalendar
      ? prisma.calendarEvent.findMany({
          where: {
            AND: [
              ...(calendarScope ? [calendarScope] : []),
              { startAt: { gte: new Date() } },
              { status: { not: "CANCELED" } },
            ],
          },
          orderBy: { startAt: "asc" },
          take: limit,
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            startAt: true,
            endAt: true,
            assignedTo: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    canFinance
      ? prisma.invoice.count({ where: { deal: dealScope } })
      : Promise.resolve(null),
    canFinance
      ? prisma.invoice.findMany({
          where: { deal: dealScope },
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            issueDate: true,
            dueDate: true,
            updatedAt: true,
            deal: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    canFinance
      ? prisma.financeTransaction.count({ where: { deal: dealScope } })
      : Promise.resolve(null),
    canFinance
      ? prisma.financeTransaction.findMany({
          where: { deal: dealScope },
          orderBy: { date: "desc" },
          take: limit,
          select: {
            id: true,
            type: true,
            status: true,
            category: true,
            amount: true,
            currency: true,
            date: true,
            deal: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    canDeals
      ? prisma.procurementRequest.count({ where: { deal: dealScope } })
      : Promise.resolve(null),
    canDeals
      ? prisma.procurementRequest.findMany({
          where: { deal: dealScope },
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            number: true,
            status: true,
            workflowStatus: true,
            priority: true,
            plannedTotal: true,
            currency: true,
            neededByDate: true,
            updatedAt: true,
            supplier: { select: { name: true } },
            deal: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    canDeals
      ? prisma.purchaseOrder.count({ where: { deal: dealScope } })
      : Promise.resolve(null),
    canDeals
      ? prisma.purchaseOrder.findMany({
          where: { deal: dealScope },
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            status: true,
            totalAmount: true,
            expectedDate: true,
            updatedAt: true,
            deal: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    canProduction
      ? prisma.productionFlow.count({ where: { deal: dealScope } })
      : Promise.resolve(null),
    canProduction
      ? prisma.productionFlow.findMany({
          where: { deal: dealScope },
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            currentStepKey: true,
            readinessPercent: true,
            blockersCount: true,
            updatedAt: true,
            deal: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    generated_at: new Date().toISOString(),
    scope: ownerFilter ? "team_or_self" : "organization",
    limit_per_section: limit,
    permissions: {
      leads: canLeads,
      deals: canDeals,
      tasks: canTasks,
      contacts: canContacts,
      calendar: canCalendar,
      finance: canFinance,
      production: canProduction,
    },
    sales: {
      leads_count: leadsCount,
      deals_count: dealsCount,
      recent_leads: recentLeads.map((r) => ({
        id: r.id,
        title: r.title,
        stage: r.stage.name,
        priority: r.priority,
        owner: r.owner.name ?? r.owner.email,
        updated_at: r.updatedAt.toISOString(),
      })),
      recent_deals: recentDeals.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        stage: r.stage.name,
        client: r.client.name,
        owner: r.owner.name ?? r.owner.email,
        value: r.value != null ? Number(r.value) : null,
        currency: r.currency,
        updated_at: r.updatedAt.toISOString(),
      })),
    },
    tasks: {
      open_count: openTasksCount,
      recent_open: recentTasks.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        task_type: r.taskType,
        entity: `${r.entityType}:${r.entityId}`,
        due_at: r.dueAt?.toISOString() ?? null,
        assignee: r.assignee.name ?? r.assignee.email,
      })),
    },
    contacts: {
      count: contactsCount,
      recent: recentContacts.map((r) => ({
        id: r.id,
        full_name: r.fullName,
        phone: r.phone,
        email: r.email,
        updated_at: r.updatedAt.toISOString(),
      })),
    },
    calendar: {
      upcoming_count: upcomingCalendarCount,
      upcoming: upcomingCalendarEvents.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        start_at: r.startAt.toISOString(),
        end_at: r.endAt.toISOString(),
        assignee: r.assignedTo?.name ?? r.assignedTo?.email ?? null,
      })),
    },
    finance: {
      invoices_count: invoicesCount,
      finance_transactions_count: financeTxCount,
      recent_invoices: recentInvoices.map((r) => ({
        id: r.id,
        deal_id: r.deal.id,
        deal_title: r.deal.title,
        type: r.type,
        status: r.status,
        amount: Number(r.amount),
        issue_date: r.issueDate?.toISOString() ?? null,
        due_date: r.dueDate?.toISOString() ?? null,
        updated_at: r.updatedAt.toISOString(),
      })),
      recent_transactions: recentFinanceTx.map((r) => ({
        id: r.id,
        deal_id: r.deal.id,
        deal_title: r.deal.title,
        type: r.type,
        status: r.status,
        category: r.category,
        amount: Number(r.amount),
        currency: r.currency,
        date: r.date.toISOString(),
      })),
    },
    procurement: {
      requests_count: procurementCount,
      purchase_orders_count: purchaseOrdersCount,
      recent_requests: recentProcurement.map((r) => ({
        id: r.id,
        number: r.number,
        deal_id: r.deal.id,
        deal_title: r.deal.title,
        supplier: r.supplier?.name ?? null,
        status: r.status,
        workflow_status: r.workflowStatus,
        priority: r.priority,
        planned_total: r.plannedTotal != null ? Number(r.plannedTotal) : null,
        currency: r.currency,
        needed_by: r.neededByDate?.toISOString() ?? null,
        updated_at: r.updatedAt.toISOString(),
      })),
      recent_purchase_orders: recentPurchaseOrders.map((r) => ({
        id: r.id,
        deal_id: r.deal.id,
        deal_title: r.deal.title,
        status: r.status,
        total_amount: Number(r.totalAmount),
        expected_date: r.expectedDate?.toISOString() ?? null,
        updated_at: r.updatedAt.toISOString(),
      })),
    },
    production: {
      flows_count: productionFlowsCount,
      recent_flows: recentProductionFlows.map((r) => ({
        id: r.id,
        number: r.number,
        title: r.title,
        deal_id: r.deal.id,
        deal_title: r.deal.title,
        status: r.status,
        current_step: r.currentStepKey,
        readiness_percent: r.readinessPercent,
        blockers_count: r.blockersCount,
        updated_at: r.updatedAt.toISOString(),
      })),
    },
    note:
      "Це не сире «навчання» моделі, а актуальний retrieval-контекст з БД у межах дозволів користувача.",
  };
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
    return { error: "Замовлення не знайдено" };
  }
  if (!canAccessOwner(ctx, deal.ownerId)) {
    return { error: "Недостатньо прав або замовлення поза вашою видимістю" };
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
