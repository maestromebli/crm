import type { Prisma } from "@prisma/client";
import {
  CalendarEventStatus,
  CalendarEventType,
  DealStatus,
  HandoffStatus,
  TaskStatus,
} from "@prisma/client";
import { addDays, endOfDay, startOfDay, subHours } from "date-fns";
import { uk } from "date-fns/locale";
import { format } from "date-fns";
import { prisma } from "../../lib/prisma";
import type { SessionAccess } from "../../lib/authz/session-access";
import { sessionUserFromAccess } from "../../lib/authz/session-access";
import {
  calendarEventWhere,
  leadWhereForAccess,
  ownerIdWhere,
  type AccessContext,
} from "../../lib/authz/data-scope";
import { hasEffectivePermission, P } from "../../lib/authz/permissions";
import { isSalesPipelineRole, normalizeRole } from "../../lib/authz/roles";
import { taskListWhereForUser } from "../../lib/tasks/prisma-scope";

export type DashboardPerms = {
  leadsView: boolean;
  leadsCreate: boolean;
  dealsView: boolean;
  dealsCreate: boolean;
  calendarView: boolean;
  tasksView: boolean;
  tasksCreate: boolean;
  notificationsView: boolean;
};

export function getDashboardPerms(access: SessionAccess): DashboardPerms {
  const granted = access.permissionKeys;
  const ctx = {
    realRole: access.realRole,
    impersonatorId: access.impersonatorId,
  };
  return {
    leadsView: hasEffectivePermission(granted, P.LEADS_VIEW, ctx),
    leadsCreate: hasEffectivePermission(granted, P.LEADS_CREATE, ctx),
    dealsView: hasEffectivePermission(granted, P.DEALS_VIEW, ctx),
    dealsCreate: hasEffectivePermission(granted, P.DEALS_CREATE, ctx),
    calendarView: hasEffectivePermission(granted, P.CALENDAR_VIEW, ctx),
    tasksView: hasEffectivePermission(granted, P.TASKS_VIEW, ctx),
    tasksCreate: hasEffectivePermission(granted, P.TASKS_CREATE, ctx),
    notificationsView: hasEffectivePermission(
      granted,
      P.NOTIFICATIONS_VIEW,
      ctx,
    ),
  };
}

export type ExecutiveDashboardPerms = DashboardPerms & {
  paymentsView: boolean;
  marginView: boolean;
  costView: boolean;
  productionView: boolean;
  procurementView: boolean;
  aiAnalytics: boolean;
};

export function getExecutiveDashboardPerms(
  access: SessionAccess,
): ExecutiveDashboardPerms {
  const base = getDashboardPerms(access);
  const granted = access.permissionKeys;
  const ctx = {
    realRole: access.realRole,
    impersonatorId: access.impersonatorId,
  };
  return {
    ...base,
    paymentsView: hasEffectivePermission(granted, P.PAYMENTS_VIEW, ctx),
    marginView: hasEffectivePermission(granted, P.MARGIN_VIEW, ctx),
    costView: hasEffectivePermission(granted, P.COST_VIEW, ctx),
    productionView:
      hasEffectivePermission(granted, P.PRODUCTION_ORDERS_VIEW, ctx) ||
      hasEffectivePermission(granted, P.PRODUCTION_LAUNCH, ctx),
    procurementView:
      hasEffectivePermission(granted, P.DEALS_VIEW, ctx) ||
      hasEffectivePermission(granted, P.COST_VIEW, ctx),
    aiAnalytics: hasEffectivePermission(granted, P.AI_ANALYTICS, ctx),
  };
}

export type DashboardAttentionItem = {
  id: string;
  label: string;
  type: "lead" | "deal" | "handoff" | "task";
  severity: "high" | "medium";
  detail: string;
  href?: string;
};

export type DashboardAgendaItem = {
  id: string;
  time: string;
  label: string;
  type:
    | "measurement"
    | "call"
    | "meeting"
    | "installation"
    | "deadline"
    | "delivery"
    | "internal";
  context: string;
};

export type DashboardDealPreview = {
  id: string;
  title: string;
  stage: string;
  valueLabel: string;
  dueLabel: string;
  owner: string;
};

export type DashboardFunnelStage = {
  stageId: string;
  name: string;
  count: number;
  note: string;
};

export type DashboardTeamMember = {
  userId: string;
  name: string;
  dealsOpen: number;
  tasksOpen: number;
};

export type DashboardHandoffTile = {
  key: string;
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "emerald" | "sky" | "amber";
};

export type DashboardSnapshot = {
  kpiNewLeads24h: number;
  kpiNewLeadsPrev24h: number;
  kpiOpenDeals: number;
  kpiDealsInContractStage: number;
  kpiOverdueTasks: number;
  attention: DashboardAttentionItem[];
  agenda: DashboardAgendaItem[];
  deals: DashboardDealPreview[];
  funnel: DashboardFunnelStage[];
  handoffTiles: DashboardHandoffTile[];
  teamLoad: DashboardTeamMember[];
  installationUpcoming: number;
  productionRisk: number;
  signatureStaleCount: number;
  signatureStaleDeals: Array<{
    dealId: string;
    title: string;
    ageHours: number;
  }>;
};

const emptySnapshot = (): DashboardSnapshot => ({
  kpiNewLeads24h: 0,
  kpiNewLeadsPrev24h: 0,
  kpiOpenDeals: 0,
  kpiDealsInContractStage: 0,
  kpiOverdueTasks: 0,
  attention: [],
  agenda: [],
  deals: [],
  funnel: [],
  handoffTiles: [],
  teamLoad: [],
  installationUpcoming: 0,
  productionRisk: 0,
  signatureStaleCount: 0,
  signatureStaleDeals: [],
});

function leadOwnerWhere(
  ctx: AccessContext,
): Prisma.LeadWhereInput | undefined {
  return leadWhereForAccess(ctx);
}

function dealOwnerWhere(
  ctx: Parameters<typeof ownerIdWhere>[0],
): Prisma.DealWhereInput | undefined {
  const ow = ownerIdWhere(ctx);
  return ow ? { ownerId: ow } : undefined;
}

function mapCalendarType(
  t: CalendarEventType,
): DashboardAgendaItem["type"] {
  switch (t) {
    case CalendarEventType.MEASUREMENT:
      return "measurement";
    case CalendarEventType.MEETING:
      return "meeting";
    case CalendarEventType.INSTALLATION:
      return "installation";
    case CalendarEventType.DELIVERY:
      return "delivery";
    default:
      return "internal";
  }
}

export async function loadDashboardSnapshot(
  access: SessionAccess,
  perms: DashboardPerms,
): Promise<DashboardSnapshot> {
  if (!process.env.DATABASE_URL?.trim()) {
    return emptySnapshot();
  }

  try {
    const ctx = access.ctx;
    const leadWhere = leadOwnerWhere(ctx);
    const dealScope = dealOwnerWhere(ctx);
    const now = new Date();
    const h24 = subHours(now, 24);
    const h48 = subHours(now, 48);
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const calScope = calendarEventWhere(ctx);
    const calBase: Prisma.CalendarEventWhereInput = {
      ...(calScope ?? {}),
      status: { not: CalendarEventStatus.CANCELED },
      startAt: { gte: dayStart, lte: dayEnd },
    };

    const sessionUser = sessionUserFromAccess(access);
    const taskScope = await taskListWhereForUser(prisma, sessionUser);
    const overdueTaskWhere: Prisma.TaskWhereInput = {
      AND: [
        taskScope,
        {
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
          dueAt: { not: null, lt: now },
        },
      ],
    };

    const [
      newLeadsLast24,
      newLeadsPrev24,
      openDeals,
      dealsContractStage,
      overdueTasks,
      staleLeads,
      submittedHandoffs,
      agendaRows,
      dealRows,
      overdueTaskCountForLabel,
      signatureStaleCount,
      signatureStaleDealsRaw,
    ] = await Promise.all([
      perms.leadsView
        ? prisma.lead.count({
            where: { ...leadWhere, createdAt: { gte: h24 } },
          })
        : Promise.resolve(0),
      perms.leadsView
        ? prisma.lead.count({
            where: {
              ...leadWhere,
              createdAt: { gte: h48, lt: h24 },
            },
          })
        : Promise.resolve(0),
      perms.dealsView
        ? prisma.deal.count({
            where: {
              ...dealScope,
              status: DealStatus.OPEN,
            },
          })
        : Promise.resolve(0),
      perms.dealsView
        ? prisma.deal.count({
            where: {
              ...dealScope,
              status: DealStatus.OPEN,
              stage: { slug: "contract" },
            },
          })
        : Promise.resolve(0),
      perms.tasksView
        ? prisma.task.count({ where: overdueTaskWhere })
        : Promise.resolve(0),
      perms.leadsView
        ? prisma.lead.count({
            where: {
              ...leadWhere,
              createdAt: { lt: h24 },
              OR: [
                { lastActivityAt: null },
                { lastActivityAt: { lt: h24 } },
              ],
            },
          })
        : Promise.resolve(0),
      perms.dealsView
        ? prisma.dealHandoff.count({
            where: {
              status: HandoffStatus.SUBMITTED,
              deal: { ...(dealScope ?? {}) },
            },
          })
        : Promise.resolve(0),
      perms.calendarView
        ? prisma.calendarEvent.findMany({
            where: calBase,
            orderBy: { startAt: "asc" },
            take: 12,
            include: {
              assignedTo: { select: { name: true, email: true } },
              lead: { select: { title: true, ownerId: true } },
            },
          })
        : Promise.resolve([]),
      perms.dealsView
        ? prisma.deal.findMany({
            where: { ...dealScope, status: DealStatus.OPEN },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: {
              id: true,
              title: true,
              expectedCloseDate: true,
              value: true,
              currency: true,
              stage: { select: { name: true } },
              owner: { select: { name: true, email: true } },
            },
          })
        : Promise.resolve([]),
      perms.tasksView
        ? prisma.task.count({
            where: {
              AND: [
                taskScope,
                {
                  status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
                  dueAt: { not: null, lt: now },
                },
                { title: { contains: "монтаж", mode: "insensitive" } },
              ],
            },
          })
        : Promise.resolve(0),
      perms.dealsView
        ? prisma.dealContract.count({
            where: {
              status: "SENT_FOR_SIGNATURE",
              updatedAt: { lt: subHours(now, 48) },
              deal: { ...(dealScope ?? {}) },
            },
          })
        : Promise.resolve(0),
      perms.dealsView
        ? prisma.dealContract.findMany({
            where: {
              status: "SENT_FOR_SIGNATURE",
              updatedAt: { lt: subHours(now, 48) },
              deal: { ...(dealScope ?? {}) },
            },
            orderBy: { updatedAt: "asc" },
            take: 5,
            select: {
              dealId: true,
              updatedAt: true,
              deal: { select: { title: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const agenda: DashboardAgendaItem[] = agendaRows.map((ev) => {
      const assignee =
        ev.assignedTo?.name ?? ev.assignedTo?.email ?? null;
      const parts = [
        assignee ? `Відповідальний: ${assignee}` : null,
        ev.lead?.title ? `Лід: ${ev.lead.title}` : null,
        ev.location ? ev.location : null,
      ].filter(Boolean);
      return {
        id: ev.id,
        time: format(ev.startAt, "HH:mm", { locale: uk }),
        label: ev.title,
        type: mapCalendarType(ev.type),
        context: parts.join(" · ") || "—",
      };
    });

    const deals: DashboardDealPreview[] = dealRows.map((d) => {
      const owner = d.owner.name ?? d.owner.email ?? "—";
      const dueLabel = d.expectedCloseDate
        ? `Очікуване закриття: ${format(d.expectedCloseDate, "d MMM", { locale: uk })}`
        : "Наступний крок: уточніть у воркспейсі";
      const valueLabel =
        d.value != null
          ? `${d.value.toLocaleString("uk-UA")} ${d.currency ?? ""}`.trim()
          : "—";
      return {
        id: d.id,
        title: d.title,
        stage: d.stage.name,
        valueLabel,
        dueLabel,
        owner,
      };
    });

    const attention: DashboardAttentionItem[] = [];
    if (perms.leadsView && staleLeads > 0) {
      attention.push({
        id: "stale-leads",
        label: `${staleLeads} лід(ів) без активності понад 24 год`,
        type: "lead",
        severity: staleLeads >= 5 ? "high" : "medium",
        detail:
          "Оновіть статус або заплануйте наступний контакт.",
        href: "/leads",
      });
    }
    if (perms.tasksView && overdueTasks > 0) {
      attention.push({
        id: "overdue-tasks",
        label: `${overdueTasks} прострочених задач`,
        type: "task",
        severity: overdueTasks >= 5 ? "high" : "medium",
        detail:
          overdueTaskCountForLabel > 0
            ? `З них згадок про монтаж у назві: ${overdueTaskCountForLabel}.`
            : "Перегляньте чергу задач.",
        href: "/tasks/overdue",
      });
    }
    if (perms.dealsView && submittedHandoffs > 0) {
      attention.push({
        id: "handoffs",
        label: `${submittedHandoffs} передач очікує підтвердження`,
        type: "handoff",
        severity: "high",
        detail: "Перевірте пакети передачі у виробництво.",
        href: "/deals",
      });
    }
    if (perms.dealsView && signatureStaleCount > 0) {
      attention.push({
        id: "signature-stale",
        label: `${signatureStaleCount} договор(ів) очікують підпис > 48 год`,
        type: "deal",
        severity: signatureStaleCount >= 3 ? "high" : "medium",
        detail: "Перевірте Дія-сесії та нагадайте клієнту.",
        href: "/deals",
      });
    }

    let funnel: DashboardFunnelStage[] = [];
    if (perms.leadsView) {
      const leadPipeline = await prisma.pipeline.findFirst({
        where: { entityType: "LEAD", isDefault: true },
        include: { stages: { orderBy: { sortOrder: "asc" } } },
      });
      if (leadPipeline?.stages.length) {
        const counts = await prisma.lead.groupBy({
          by: ["stageId"],
          where: { ...leadWhere },
          _count: { _all: true },
        });
        const countMap = new Map(
          counts.map((c) => [c.stageId, c._count._all]),
        );
        funnel = leadPipeline.stages
          .filter((s) => !s.isFinal)
          .map((s) => ({
            stageId: s.id,
            name: s.name,
            count: countMap.get(s.id) ?? 0,
            note: "у стадії",
          }));
      }
    }

    let handoffTiles: DashboardHandoffTile[] = [];
    let installationUpcoming = 0;
    let productionRisk = 0;

    if (perms.dealsView) {
      const dealPipeline = await prisma.pipeline.findFirst({
        where: { entityType: "DEAL", isDefault: true },
        include: { stages: true },
      });
      const stageIdBySlug = (slug: string) =>
        dealPipeline?.stages.find((s) => s.slug === slug)?.id;

      const handoffStageId = stageIdBySlug("handoff");
      const productionStageId = stageIdBySlug("production");

      const [dealsInHandoffStage, inProduction] = await Promise.all([
        handoffStageId
          ? prisma.deal.count({
              where: {
                ...dealScope,
                status: DealStatus.OPEN,
                stageId: handoffStageId,
              },
            })
          : Promise.resolve(0),
        productionStageId
          ? prisma.deal.count({
              where: {
                ...dealScope,
                status: DealStatus.OPEN,
                stageId: productionStageId,
              },
            })
          : Promise.resolve(0),
      ]);

      if (productionStageId) {
        productionRisk = await prisma.deal.count({
          where: {
            ...dealScope,
            status: DealStatus.OPEN,
            stageId: productionStageId,
            expectedCloseDate: { not: null, lt: now },
          },
        });
      }

      handoffTiles = [
        {
          key: "submitted",
          label: "Очікують підтвердження",
          value: submittedHandoffs,
          hint: `${dealsInHandoffStage} замовлень на етапі «Передача».`,
          tone: "neutral",
        },
        {
          key: "production",
          label: "Виробництво",
          value: inProduction,
          hint: "Відкриті замовлення на стадії виробництва.",
          tone: "emerald",
        },
      ];

      if (perms.calendarView) {
        const installWhere: Prisma.CalendarEventWhereInput = {
          ...(calScope ?? {}),
          type: CalendarEventType.INSTALLATION,
          status: { not: CalendarEventStatus.CANCELED },
          startAt: {
            gte: now,
            lte: endOfDay(addDays(now, 14)),
          },
        };
        installationUpcoming = await prisma.calendarEvent.count({
          where: installWhere,
        });
        handoffTiles.push({
          key: "install",
          label: "Монтаж (2 тижні)",
          value: installationUpcoming,
          hint: "Заплановані монтажі у календарі.",
          tone: "sky",
        });
      }

      handoffTiles.push({
        key: "risk",
        label: "Ризик по даті закриття",
        value: productionRisk,
        hint: "У виробництві з простроченим очікуваним закриттям.",
        tone: "amber",
      });
    }

    let teamLoad: DashboardTeamMember[] = [];
    const role = normalizeRole(access.role);
    const showTeam =
      isSalesPipelineRole(role) &&
      role !== "SALES_MANAGER" &&
      (perms.dealsView || perms.tasksView);

    if (showTeam) {
      const dealGroupWhere: Prisma.DealWhereInput = {
        status: DealStatus.OPEN,
        ...(dealScope ?? {}),
      };
      const [dealGroups, taskGroups] = await Promise.all([
        perms.dealsView
          ? prisma.deal.groupBy({
              by: ["ownerId"],
              where: dealGroupWhere,
              _count: { _all: true },
              orderBy: { _count: { ownerId: "desc" } },
              take: 8,
            })
          : Promise.resolve([]),
        perms.tasksView
          ? prisma.task.groupBy({
              by: ["assigneeId"],
              where: {
                AND: [
                  taskScope,
                  {
                    status: {
                      in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS],
                    },
                  },
                ],
              },
              _count: { _all: true },
              orderBy: { _count: { assigneeId: "desc" } },
              take: 8,
            })
          : Promise.resolve([]),
      ]);

      const userIds = new Set<string>();
      for (const g of dealGroups) userIds.add(g.ownerId);
      for (const g of taskGroups) userIds.add(g.assigneeId);

      if (userIds.size > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true, email: true },
        });
        const nameById = new Map(
          users.map((u) => [
            u.id,
            u.name ?? u.email ?? u.id.slice(0, 6),
          ]),
        );
        const dealsBy = new Map(
          dealGroups.map((g) => [g.ownerId, g._count._all]),
        );
        const tasksBy = new Map(
          taskGroups.map((g) => [g.assigneeId, g._count._all]),
        );

        teamLoad = [...userIds].map((id) => ({
          userId: id,
          name: nameById.get(id) ?? id,
          dealsOpen: dealsBy.get(id) ?? 0,
          tasksOpen: tasksBy.get(id) ?? 0,
        }));
        teamLoad.sort(
          (a, b) =>
            b.dealsOpen +
            b.tasksOpen -
            (a.dealsOpen + a.tasksOpen),
        );
        teamLoad = teamLoad.slice(0, 8);
      }
    }

    return {
      kpiNewLeads24h: newLeadsLast24,
      kpiNewLeadsPrev24h: newLeadsPrev24,
      kpiOpenDeals: openDeals,
      kpiDealsInContractStage: dealsContractStage,
      kpiOverdueTasks: overdueTasks,
      attention,
      agenda,
      deals,
      funnel,
      handoffTiles,
      teamLoad,
      installationUpcoming,
      productionRisk,
      signatureStaleCount,
      signatureStaleDeals: signatureStaleDealsRaw.map((x) => ({
        dealId: x.dealId,
        title: x.deal.title,
        ageHours: Math.max(
          0,
          Math.floor((+now - +x.updatedAt) / (60 * 60 * 1000)),
        ),
      })),
    };
  } catch {
    return emptySnapshot();
  }
}
