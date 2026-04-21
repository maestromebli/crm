import {
  CalendarEventStatus,
  CalendarEventType,
  DealStatus,
  MoneyTransactionStatus,
  Prisma,
  ProductionFlowStatus,
  ProductionRiskSeverity,
  TaskStatus,
  HandoffStatus,
} from "@prisma/client";
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { uk } from "date-fns/locale";
import { prisma } from "../../lib/prisma";

/** Optional Prisma models (finance / legacy) — absent in some schema versions. */
const prismaRecord = prisma as unknown as Record<string, unknown>;
function prismaHasDelegate(name: string): boolean {
  const d = prismaRecord[name];
  return typeof d === "object" && d !== null;
}

const hasMoneyTransaction = prismaHasDelegate("moneyTransaction");
const hasInvoice = prismaHasDelegate("invoice");
const hasDealPurchaseOrder = prismaHasDelegate("dealPurchaseOrder");
const hasStockItem = prismaHasDelegate("stockItem");
const hasProductionOrder = prismaHasDelegate("productionOrder");
const hasProductionIssue = prismaHasDelegate("productionIssue");

/** String enums for optional tables (must match DB values when those tables exist). */
const MoneyFlowType = { INCOME: "INCOME", EXPENSE: "EXPENSE" } as const;
const CrmInvoiceStatus = { SENT: "SENT" } as const;
const DealPurchaseOrderStatus = {
  DRAFT: "DRAFT",
  ORDERED: "ORDERED",
  DELIVERED: "DELIVERED",
} as const;
const ProductionOrderStatus = {
  QUEUED: "QUEUED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
} as const;
const ProductionIssueStatus = { OPEN: "OPEN" } as const;
import type { SessionAccess } from "../../lib/authz/session-access";
import { sessionUserFromAccess } from "../../lib/authz/session-access";
import {
  calendarEventWhere,
  leadWhereForAccess,
  ownerIdWhere,
  type AccessContext,
} from "../../lib/authz/data-scope";
import {
  getExecutiveLayoutMode,
  hasCompanyOperationsScope,
  type EffectiveRole,
} from "../../lib/authz/roles";
import { hasEffectivePermission, P } from "../../lib/authz/permissions";
import type { ExecutiveDashboardPerms } from "../dashboard/queries";
import { taskListWhereForUser } from "../../lib/tasks/prisma-scope";
import type {
  BehaviorEngineSnapshot,
  CashflowPreview,
  DailyOperatingSnapshot,
  DirectorAiBlock,
  ExecutiveDashboardPayload,
  ExecutiveDashboardQuery,
  FinanceOverview,
  FunnelStageRow,
  KpiDelta,
  KpiEntry,
  NextActionItem,
  ProcurementOverview,
  ProductionOverview,
  RiskRow,
  RiskType,
  ScheduleItem,
  SchedulePreview,
  TeamPerformanceBlock,
  TrendPoint,
} from "./executive-types";
import { loadBehaviorSnapshot } from "../behavior-engine/load-behavior-snapshot";
import { buildDailyOperatingSnapshot } from "../daily-operating-system/build-daily-operating-snapshot";

type DashboardCacheEntry = {
  expiresAt: number;
  value: ExecutiveDashboardPayload;
};

const DASHBOARD_CACHE_TTL_MS = 15_000;
const DASHBOARD_CACHE_MAX_ENTRIES = 80;
const dashboardPayloadCache = new Map<string, DashboardCacheEntry>();

function makeDashboardCacheKey(input: {
  access: SessionAccess;
  perms: ExecutiveDashboardPerms;
  role: EffectiveRole;
  query: ExecutiveDashboardQuery;
}): string {
  return JSON.stringify({
    userId: input.access.userId,
    role: input.role,
    realRole: input.access.realRole,
    impersonatorId: input.access.impersonatorId ?? null,
    ctx: input.access.ctx,
    perms: input.perms,
    query: input.query,
  });
}

function readDashboardPayloadCache(key: string): ExecutiveDashboardPayload | null {
  const entry = dashboardPayloadCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    dashboardPayloadCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeDashboardPayloadCache(key: string, value: ExecutiveDashboardPayload): void {
  if (dashboardPayloadCache.size >= DASHBOARD_CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestExpiry = Number.POSITIVE_INFINITY;
    for (const [existingKey, existing] of dashboardPayloadCache.entries()) {
      if (existing.expiresAt < oldestExpiry) {
        oldestExpiry = existing.expiresAt;
        oldestKey = existingKey;
      }
    }
    if (oldestKey) dashboardPayloadCache.delete(oldestKey);
  }
  dashboardPayloadCache.set(key, {
    value,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
  });
}

function num(n: unknown): number {
  if (n == null) return 0;
  if (typeof n === "number") return Number.isFinite(n) ? n : 0;
  if (typeof n === "object" && "toNumber" in n && typeof (n as { toNumber: () => number }).toNumber === "function") {
    return Number((n as { toNumber: () => number }).toNumber().toFixed(2));
  }
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function dealScope(
  ctx: AccessContext,
  extra?: Prisma.DealWhereInput,
): Prisma.DealWhereInput {
  const ow = ownerIdWhere(ctx);
  const base: Prisma.DealWhereInput = ow ? { ownerId: ow } : {};
  if (!extra) return base;
  return Object.keys(base).length ? { AND: [base, extra] } : extra;
}

function moneyTxScope(ctx: AccessContext): Prisma.MoneyTransactionWhereInput {
  const dw = dealScope(ctx);
  if (!dw || Object.keys(dw).length === 0) return {};
  return { deal: { is: dw } };
}

function productionScope(
  role: EffectiveRole,
  ctx: AccessContext,
): Prisma.ProductionFlowWhereInput | undefined {
  if (hasCompanyOperationsScope(role)) return undefined;
  const dw = dealScope(ctx);
  return dw ? { deal: { is: dw } } : undefined;
}

function financeRangeBounds(
  range: ExecutiveDashboardQuery["financeRange"],
  now: Date,
): { start: Date; end: Date } {
  const end = endOfDay(now);
  switch (range) {
    case "today":
      return { start: startOfDay(now), end };
    case "week":
      return { start: startOfDay(subDays(now, 6)), end };
    case "month":
      return { start: startOfMonth(now), end };
    case "quarter": {
      const sm = startOfMonth(now);
      const start = subMonths(sm, 2);
      return { start, end };
    }
    default:
      return { start: startOfDay(subDays(now, 6)), end };
  }
}

function trendBounds(
  trendRange: ExecutiveDashboardQuery["trendRange"],
  now: Date,
): { start: Date; end: Date } {
  const end = endOfDay(now);
  switch (trendRange) {
    case "7d":
      return { start: startOfDay(subDays(now, 6)), end };
    case "30d":
      return { start: startOfDay(subDays(now, 29)), end };
    case "90d":
      return { start: startOfDay(subDays(now, 89)), end };
    case "year":
      return { start: startOfDay(subDays(now, 364)), end };
    default:
      return { start: startOfDay(subDays(now, 29)), end };
  }
}

function deltaVsPrev(
  current: number,
  previous: number,
  label: string,
): KpiDelta | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const absolute = current - previous;
  const percent =
    previous !== 0 ? (absolute / Math.abs(previous)) * 100 : null;
  return { absolute, percent, label };
}

const DEFAULT_DASHBOARD_BEHAVIOR: BehaviorEngineSnapshot = {
  teamBehaviorScore: 0,
  managerScores: [],
  weakManagers: [],
  alerts: [],
};

const DEFAULT_DASHBOARD_DAILY: DailyOperatingSnapshot = {
  priorities: [],
  workload: {
    overdueTasks: 0,
    meetingsToday: 0,
    staleLeads: 0,
    delayedProduction: 0,
  },
  weakManagers: [],
};

function buildEmptyDashboardPayload(
  layout: ExecutiveDashboardPayload["layout"],
  query: ExecutiveDashboardQuery,
  opts?: {
    error?: string;
    aiSummaryLine?: string;
  },
): ExecutiveDashboardPayload {
  return {
    layout,
    query,
    kpis: [],
    funnel: [],
    trend: [],
    cashflow: null,
    nextActions: [],
    risks: [],
    team: null,
    finance: null,
    production: null,
    procurement: null,
    schedule: null,
    directorAi: {
      summaryLines: [opts?.aiSummaryLine ?? "Завантажуємо дані для AI-блоку…"],
      problems: [],
      recommendations: [],
      forecast: { revenue: "—", risks: "—", bottlenecks: "—" },
    },
    behavior: DEFAULT_DASHBOARD_BEHAVIOR,
    daily: DEFAULT_DASHBOARD_DAILY,
    legacyAttentionCount: 0,
    ...(opts?.error ? { error: opts.error } : {}),
  };
}

export async function loadExecutiveDashboard(
  access: SessionAccess,
  perms: ExecutiveDashboardPerms,
  role: EffectiveRole,
  query: ExecutiveDashboardQuery,
): Promise<ExecutiveDashboardPayload> {
  const layout = getExecutiveLayoutMode(role);
  const cacheKey = makeDashboardCacheKey({ access, perms, role, query });
  const cached = readDashboardPayloadCache(cacheKey);
  if (cached) {
    return cached;
  }
  const cacheAndReturn = (payload: ExecutiveDashboardPayload) => {
    if (!payload.error) {
      writeDashboardPayloadCache(cacheKey, payload);
    }
    return payload;
  };

  if (!process.env.DATABASE_URL?.trim()) {
    return cacheAndReturn(
      buildEmptyDashboardPayload(layout, query, {
        error: "База даних не налаштована.",
      }),
    );
  }

  const ctx = access.ctx;
  const leadBase = leadWhereForAccess(ctx) ?? {};
  const dealBase = dealScope(ctx);
  const permCtx = {
    realRole: access.realRole,
    impersonatorId: access.impersonatorId,
  };
  const canMoney = hasEffectivePermission(
    access.permissionKeys,
    P.PAYMENTS_VIEW,
    permCtx,
  );
  const sessionUser = sessionUserFromAccess(access);
  const taskScope = perms.tasksView
    ? await taskListWhereForUser(prisma, sessionUser)
    : null;

  const managerFilter = query.managerId
    ? { ownerId: query.managerId }
    : undefined;
  const leadWhere: Prisma.LeadWhereInput = {
    ...leadBase,
    ...(managerFilter ? { ownerId: managerFilter.ownerId } : {}),
    ...(query.source
      ? { source: { contains: query.source, mode: "insensitive" } }
      : {}),
  };

  const dealWhere: Prisma.DealWhereInput = {
    ...dealBase,
    ...(managerFilter ? { ownerId: managerFilter.ownerId } : {}),
    ...(query.dealStatus && query.dealStatus in DealStatus
      ? { status: query.dealStatus as DealStatus }
      : {}),
  };

  const prodWhere = productionScope(role, ctx);
  const mtWhere = moneyTxScope(ctx);
  const now = new Date();
  const monthStart = startOfMonth(now);
  const prevMonthStart = subMonths(monthStart, 1);
  const prevMonthEnd = endOfMonth(subMonths(now, 1));
  const staleLeadsCountPromise =
    perms.leadsView
      ? prisma.lead.count({
          where: {
            ...leadWhere,
            stage: { isFinal: false },
            OR: [
              { lastActivityAt: null },
              { lastActivityAt: { lt: subDays(now, 2) } },
            ],
          },
        })
      : Promise.resolve(0);
  const overdueTasksCountPromise =
    perms.tasksView && taskScope
      ? prisma.task.count({
          where: {
            AND: [
              taskScope,
              {
                status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
                dueAt: { not: null, lt: now },
              },
            ],
          },
        })
      : Promise.resolve(0);
  const submittedHandoffsCountPromise =
    perms.dealsView
      ? prisma.dealHandoff.count({
          where: {
            status: HandoffStatus.SUBMITTED,
            deal: { is: dealWhere },
          },
        })
      : Promise.resolve(0);
  const teamBlockPromise =
    layout === "sales"
      ? Promise.resolve(null)
      : overdueTasksCountPromise.then((overdueTasksCount) =>
          loadTeamPerformance(
            perms,
            sessionUser,
            dealWhere,
            now,
            overdueTasksCount,
          ),
        );

  try {
    if (layout === "measurer") {
      const schedule = await loadSchedulePreview(access, perms, role);
      return cacheAndReturn({
        layout,
        query,
        kpis: [],
        funnel: [],
        trend: [],
        cashflow: null,
        nextActions: [],
        risks: [],
        team: null,
        finance: null,
        production: null,
        procurement: null,
        schedule,
        directorAi: buildDirectorAiStub("measurer"),
        behavior: DEFAULT_DASHBOARD_BEHAVIOR,
        daily: DEFAULT_DASHBOARD_DAILY,
        legacyAttentionCount: 0,
      });
    }

    const [
      revenueInWork,
      paidMonth,
      paidPrevMonth,
      expectedIncoming,
      openDealsForForecast,
      activeLeads,
      productionStats,
      funnelData,
      trendData,
      cashflow,
      financeBlock,
      productionBlock,
      procurementBlock,
      schedule,
      riskRows,
      teamBlock,
      staleLeadsCount,
      overdueTasksCount,
      submittedHandoffsCount,
    ] = await Promise.all([
      perms.dealsView
        ? prisma.deal.aggregate({
            where: {
              ...dealWhere,
              status: { in: [DealStatus.OPEN, DealStatus.ON_HOLD] },
            },
            _sum: { value: true },
          })
        : Promise.resolve({ _sum: { value: null } }),
      canMoney && hasMoneyTransaction
        ? (prisma as unknown as { moneyTransaction: { aggregate: (a: unknown) => Promise<{ _sum: { amount: unknown } }> } }).moneyTransaction.aggregate({
            where: {
              ...mtWhere,
              type: MoneyFlowType.INCOME,
              status: MoneyTransactionStatus.PAID,
              paidAt: { gte: monthStart, lte: now },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      canMoney && hasMoneyTransaction
        ? (prisma as unknown as { moneyTransaction: { aggregate: (a: unknown) => Promise<{ _sum: { amount: unknown } }> } }).moneyTransaction.aggregate({
            where: {
              ...mtWhere,
              type: MoneyFlowType.INCOME,
              status: MoneyTransactionStatus.PAID,
              paidAt: { gte: prevMonthStart, lte: prevMonthEnd },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      canMoney && hasInvoice
        ? (prisma as unknown as { invoice: { aggregate: (a: unknown) => Promise<{ _sum: { amount: unknown } }> } }).invoice.aggregate({
            where: {
              status: CrmInvoiceStatus.SENT,
              deal: { is: dealWhere },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      perms.dealsView
        ? prisma.deal.findMany({
            where: { ...dealWhere, status: DealStatus.OPEN },
            take: 150,
            select: {
              id: true,
              value: true,
              ...(hasDealPurchaseOrder
                ? {
                    dealPurchaseOrders: {
                      where: {
                        status: {
                          in: [
                            DealPurchaseOrderStatus.ORDERED,
                            DealPurchaseOrderStatus.DELIVERED,
                          ],
                        },
                      },
                      select: { total: true },
                    },
                  }
                : {}),
              ...(hasMoneyTransaction
                ? {
                    moneyTransactions: {
                      where: {
                        type: MoneyFlowType.EXPENSE,
                        status: MoneyTransactionStatus.PAID,
                      },
                      select: { amount: true },
                    },
                  }
                : {}),
            },
          })
        : Promise.resolve([]),
      perms.leadsView
        ? prisma.lead.count({
            where: { ...leadWhere, stage: { isFinal: false } },
          })
        : Promise.resolve(0),
      perms.productionView
        ? loadProductionStats(prodWhere)
        : Promise.resolve({
            queued: 0,
            inProgress: 0,
            delayed: 0,
            ready: 0,
            loadPct: 0,
            ringPct: 0,
            atRiskCount: 0,
            issues: [] as { id: string; title: string; orderId: string }[],
            delayedOrders: [] as {
              id: string;
              dealTitle: string;
              deadline: Date | null;
            }[],
          }),
      perms.leadsView
        ? loadFunnel(leadWhere)
        : Promise.resolve([] as FunnelStageRow[]),
      perms.dealsView || canMoney
        ? loadTrendSeries(
            dealWhere,
            mtWhere,
            canMoney,
            perms.dealsView,
            trendBounds(query.trendRange, now),
          )
        : Promise.resolve([] as TrendPoint[]),
      canMoney ? loadCashflow(mtWhere, now) : Promise.resolve(null),
      perms.paymentsView || perms.marginView
        ? loadFinanceOverview(dealWhere, mtWhere, canMoney, now)
        : Promise.resolve(null),
      perms.productionView
        ? loadProductionOverview(prodWhere, now)
        : Promise.resolve(null),
      perms.procurementView ? loadProcurementOverview(dealWhere) : Promise.resolve(null),
      perms.calendarView
        ? loadSchedulePreview(access, perms, role)
        : Promise.resolve(null),
      perms.dealsView
        ? loadRisks(dealWhere, prodWhere, now)
        : Promise.resolve([] as RiskRow[]),
      teamBlockPromise,
      staleLeadsCountPromise,
      overdueTasksCountPromise,
      submittedHandoffsCountPromise,
    ]);

    const nextActions = await loadNextActions(access, perms, dealWhere, submittedHandoffsCount, {
      staleLeadsCount,
      overdueTasksCount,
      productionAtRiskCount: productionStats.atRiskCount,
    });

    const revWork = num(revenueInWork._sum.value);
    const paidM = num(paidMonth._sum.amount);
    const paidPrev = num(paidPrevMonth._sum.amount);
    const expected = num(expectedIncoming._sum.amount);

    let grossForecast = 0;
    for (const d of openDealsForForecast) {
      const v = num(d.value);
      const row = d as typeof d & {
        dealPurchaseOrders?: { total: unknown }[];
        moneyTransactions?: { amount: unknown }[];
      };
      const po = hasDealPurchaseOrder
        ? (row.dealPurchaseOrders ?? []).reduce((s, p) => s + num(p.total), 0)
        : 0;
      const exp = hasMoneyTransaction
        ? (row.moneyTransactions ?? []).reduce((s, x) => s + num(x.amount), 0)
        : 0;
      grossForecast += Math.max(0, v - po - exp);
    }

    const { loadPct, ringPct } = productionStats;

    const kpis: KpiEntry[] = [];
    if (perms.dealsView) {
      kpis.push({
        id: "rev_work",
        title: "Виручка в роботі",
        hint: "Сума активних замовлень (OPEN / ON_HOLD) у вашій видимості.",
        value: formatUah(revWork),
        valueNumeric: revWork,
        delta: null,
        format: "currency",
      });
    }
    if (canMoney) {
      kpis.push({
        id: "paid_month",
        title: "Сплачено цього місяця",
        hint: "Фактичні надходження (INCOME, PAID) за поточний місяць.",
        value: formatUah(paidM),
        valueNumeric: paidM,
        delta: deltaVsPrev(paidM, paidPrev, "vs попередній місяць"),
        format: "currency",
      });
      kpis.push({
        id: "expected",
        title: "Очікувані надходження",
        hint: "Рахунки зі статусом «Надіслано» (не сплачені).",
        value: formatUah(expected),
        valueNumeric: expected,
        delta: null,
        format: "currency",
      });
    }
    if (perms.marginView || perms.dealsView) {
      kpis.push({
        id: "gross_forecast",
        title: "Прогноз валового прибутку",
        hint: "Оцінка: value − закупівлі − витрати по відкритих замовленнях (до 150 шт.).",
        value: formatUah(grossForecast),
        valueNumeric: grossForecast,
        delta: null,
        format: "currency",
      });
    }
    if (perms.leadsView) {
      kpis.push({
        id: "leads",
        title: "Активні ліди",
        hint: "Ліди не в фінальній стадії воронки.",
        value: String(activeLeads),
        valueNumeric: activeLeads,
        delta: null,
        format: "count",
      });
    }
    if (perms.productionView) {
      kpis.push({
        id: "prod_load",
        title: "Завантаження виробництва",
        hint: "Активні замовлення та відсоток завантаження цеху.",
        value: `${productionStats.queued + productionStats.inProgress} · ${loadPct}%`,
        valueNumeric: loadPct,
        delta: null,
        format: "percent",
      });
    }

    const directorAi = buildDirectorAi({
      revWork,
      paidM,
      expected,
      grossForecast,
      activeLeads,
      risks: riskRows,
      nextActions,
      finance: financeBlock,
      production: productionBlock,
    });

    const taskWhereForBehavior: Prisma.TaskWhereInput = perms.tasksView && taskScope
      ? taskScope
      : { id: { in: [] } };
    const behavior = await loadBehaviorSnapshot({
      now,
      leadWhere,
      dealWhere,
      taskWhere: taskWhereForBehavior,
    });
    const daily = buildDailyOperatingSnapshot({
      nextActions,
      behavior,
      overdueTasks: overdueTasksCount,
      meetingsToday: schedule?.today.length ?? 0,
      staleLeads: staleLeadsCount,
      delayedProduction: productionBlock?.delayed ?? 0,
    });

    return cacheAndReturn({
      layout,
      query,
      kpis,
      funnel: funnelData,
      trend: trendData,
      cashflow,
      nextActions,
      risks: riskRows.slice(0, 12),
      team: teamBlock,
      finance: financeBlock,
      production: productionBlock,
      procurement: procurementBlock,
      schedule,
      directorAi,
      behavior,
      daily,
      legacyAttentionCount: 0,
    });
  } catch (e) {
    console.error("loadExecutiveDashboard", e);
    return buildEmptyDashboardPayload(layout, query, {
      aiSummaryLine:
        "Не вдалося завантажити агрегати дашборду. Спробуйте оновити сторінку.",
      error: "Помилка завантаження даних.",
    });
  }
}

function formatUah(n: number): string {
  const rounded = Math.round(Number.isFinite(n) ? n : 0);
  const withSpaces = rounded
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${withSpaces}\u00a0₴`;
}

async function loadFunnel(
  leadWhere: Prisma.LeadWhereInput,
): Promise<FunnelStageRow[]> {
  const pipeline = await prisma.pipeline.findFirst({
    where: { entityType: "LEAD", isDefault: true },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
  if (!pipeline?.stages.length) return [];

  const leads = await prisma.lead.findMany({
    where: leadWhere,
    select: {
      stageId: true,
      activeEstimate: { select: { totalPrice: true } },
    },
  });

  const amountByStage = new Map<string, number>();
  const countByStage = new Map<string, number>();
  for (const l of leads) {
    countByStage.set(l.stageId, (countByStage.get(l.stageId) ?? 0) + 1);
    const est = l.activeEstimate?.totalPrice;
    const a = typeof est === "number" && Number.isFinite(est) ? est : 0;
    amountByStage.set(l.stageId, (amountByStage.get(l.stageId) ?? 0) + a);
  }

  const stages = pipeline.stages.filter((s) => !s.isFinal);
  const rows: FunnelStageRow[] = [];
  let prevCount: number | null = null;
  for (const s of stages) {
    const c = countByStage.get(s.id) ?? 0;
    const amount = amountByStage.get(s.id) ?? 0;
    let conversionPct: number | null = null;
    let dropoffPct: number | null = null;
    if (prevCount !== null && prevCount > 0) {
      conversionPct = (c / prevCount) * 100;
      dropoffPct = 100 - conversionPct;
    }
    prevCount = c;
    rows.push({
      stageId: s.id,
      name: s.name,
      slug: s.slug,
      count: c,
      amount,
      conversionPct,
      dropoffPct,
    });
  }
  return rows;
}

async function loadTrendSeries(
  dealWhere: Prisma.DealWhereInput,
  mtWhere: Record<string, unknown>,
  canMoney: boolean,
  dealsView: boolean,
  bounds: { start: Date; end: Date },
): Promise<TrendPoint[]> {
  const days = eachDayOfInterval({ start: bounds.start, end: bounds.end });

  const [wonDeals, incomeTx, expenseTx] = await Promise.all([
    dealsView
      ? prisma.deal.findMany({
          where: {
            ...dealWhere,
            status: DealStatus.WON,
            updatedAt: { gte: bounds.start, lte: bounds.end },
          },
          select: { value: true, updatedAt: true },
        })
      : Promise.resolve([]),
    canMoney && hasMoneyTransaction
      ? (prisma as unknown as { moneyTransaction: { findMany: (a: unknown) => Promise<{ amount: unknown; paidAt: Date | null }[]> } }).moneyTransaction.findMany({
          where: {
            ...mtWhere,
            type: MoneyFlowType.INCOME,
            status: MoneyTransactionStatus.PAID,
            paidAt: { gte: bounds.start, lte: bounds.end },
          },
          select: { amount: true, paidAt: true },
        })
      : Promise.resolve([]),
    canMoney && hasMoneyTransaction
      ? (prisma as unknown as { moneyTransaction: { findMany: (a: unknown) => Promise<{ amount: unknown; paidAt: Date | null }[]> } }).moneyTransaction.findMany({
          where: {
            ...mtWhere,
            type: MoneyFlowType.EXPENSE,
            status: MoneyTransactionStatus.PAID,
            paidAt: { gte: bounds.start, lte: bounds.end },
          },
          select: { amount: true, paidAt: true },
        })
      : Promise.resolve([]),
  ]);

  const revByDay = new Map<string, number>();
  for (const d of wonDeals) {
    const key = format(startOfDay(d.updatedAt), "yyyy-MM-dd");
    revByDay.set(key, (revByDay.get(key) ?? 0) + num(d.value));
  }
  const payByDay = new Map<string, number>();
  for (const t of incomeTx) {
    const dt = t.paidAt ?? bounds.start;
    const key = format(startOfDay(dt), "yyyy-MM-dd");
    payByDay.set(key, (payByDay.get(key) ?? 0) + num(t.amount));
  }
  const expByDay = new Map<string, number>();
  for (const t of expenseTx) {
    const dt = t.paidAt ?? bounds.start;
    const key = format(startOfDay(dt), "yyyy-MM-dd");
    expByDay.set(key, (expByDay.get(key) ?? 0) + num(t.amount));
  }

  return days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const revenue = revByDay.get(key) ?? 0;
    const payments = payByDay.get(key) ?? 0;
    const expenses = expByDay.get(key) ?? 0;
    return {
      label: format(day, "d MMM", { locale: uk }),
      date: key,
      revenue,
      payments,
      grossProfit: payments - expenses,
      expenses,
    };
  });
}

async function loadCashflow(
  mtWhere: Record<string, unknown>,
  now: Date,
): Promise<CashflowPreview> {
  if (!hasMoneyTransaction) {
    return {
      received: 0,
      outgoing: 0,
      balance: 0,
      forecast7d: 0,
      currency: "UAH",
    };
  }
  const start = subDays(now, 89);
  const txs = await (prisma as unknown as { moneyTransaction: { findMany: (a: unknown) => Promise<{ type: string; amount: unknown; paidAt: Date | null }[]> } }).moneyTransaction.findMany({
    where: {
      ...mtWhere,
      status: MoneyTransactionStatus.PAID,
      paidAt: { gte: start, lte: now },
    },
    select: { type: true, amount: true, paidAt: true },
  });
  let received = 0;
  let outgoing = 0;
  for (const t of txs) {
    const n = num(t.amount);
    if (t.type === MoneyFlowType.INCOME) received += n;
    else outgoing += n;
  }
  const balance = received - outgoing;
  const weekIncome = await (prisma as unknown as { moneyTransaction: { aggregate: (a: unknown) => Promise<{ _sum: { amount: unknown } }> } }).moneyTransaction.aggregate({
    where: {
      ...mtWhere,
      type: MoneyFlowType.INCOME,
      status: MoneyTransactionStatus.PAID,
      paidAt: { gte: subDays(now, 7), lte: now },
    },
    _sum: { amount: true },
  });
  const forecast7d = num(weekIncome._sum.amount) * 0.35;

  return {
    received,
    outgoing,
    balance,
    forecast7d,
    currency: "UAH",
  };
}

async function loadFinanceOverview(
  dealWhere: Prisma.DealWhereInput,
  mtWhere: Record<string, unknown>,
  canMoney: boolean,
  now: Date,
): Promise<FinanceOverview | null> {
  const pmt = hasMoneyTransaction
    ? (prisma as unknown as { moneyTransaction: { aggregate: (a: unknown) => Promise<{ _sum: { amount: unknown } }> } }).moneyTransaction
    : null;

  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const [paymentsToday, overduePay, expensesMonth, unpaidInv, dealsMargin] =
    await Promise.all([
      canMoney && pmt
        ? pmt.aggregate({
            where: {
              ...mtWhere,
              type: MoneyFlowType.INCOME,
              status: MoneyTransactionStatus.PAID,
              paidAt: { gte: dayStart, lte: dayEnd },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      canMoney && pmt
        ? pmt.aggregate({
            where: {
              ...mtWhere,
              type: MoneyFlowType.INCOME,
              status: MoneyTransactionStatus.PENDING,
              dueDate: { lt: now },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      canMoney && pmt
        ? pmt.aggregate({
            where: {
              ...mtWhere,
              type: MoneyFlowType.EXPENSE,
              status: MoneyTransactionStatus.PAID,
              paidAt: { gte: startOfMonth(now), lte: now },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      dealWhere && hasInvoice
        ? (prisma as unknown as { invoice: { findMany: (a: unknown) => Promise<{ id: string; amount: unknown; status: string; updatedAt: Date; deal: { id: string; title: string } }[]> } }).invoice.findMany({
            where: {
              status: CrmInvoiceStatus.SENT,
              deal: { is: dealWhere },
            },
            orderBy: { updatedAt: "desc" },
            take: 6,
            select: {
              id: true,
              amount: true,
              status: true,
              updatedAt: true,
              deal: { select: { id: true, title: true } },
            },
          })
        : Promise.resolve([]),
      dealWhere
        ? prisma.deal.findMany({
            where: { ...dealWhere, status: DealStatus.OPEN },
            take: 8,
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              title: true,
              value: true,
              ...(hasDealPurchaseOrder
                ? { dealPurchaseOrders: { select: { total: true } } }
                : {}),
            },
          })
        : Promise.resolve([]),
    ]);

  const marginByDeal = dealsMargin.map((d) => {
    const rev = num(d.value);
    const pos = (d as { dealPurchaseOrders?: { total: unknown }[] }).dealPurchaseOrders;
    const cost = hasDealPurchaseOrder
      ? (pos ?? []).reduce((s, p) => s + num(p.total), 0)
      : 0;
    const marginPct =
      rev > 0 ? ((rev - cost) / rev) * 100 : null;
    return {
      dealId: d.id,
      title: d.title,
      revenue: rev,
      marginPct:
        marginPct != null && Number.isFinite(marginPct)
          ? Math.round(marginPct * 10) / 10
          : null,
    };
  });

  return {
    paymentsToday: num(paymentsToday._sum.amount),
    paymentsOverdue: num(overduePay._sum.amount),
    expensesMonth: num(expensesMonth._sum.amount),
    topUnpaidInvoices: unpaidInv.map((inv) => ({
      id: inv.id,
      dealId: inv.deal.id,
      dealTitle: inv.deal.title,
      amount: num(inv.amount),
      status: inv.status,
      daysOverdue: Math.max(
        0,
        Math.floor((+now - +inv.updatedAt) / (86400000)),
      ),
    })),
    marginByDeal,
  };
}

async function loadProductionStats(
  prodWhere: Prisma.ProductionFlowWhereInput | undefined,
) {
  if (hasProductionOrder) {
    const base = (prodWhere ?? {}) as Record<string, unknown>;
    const issueOrderFilter =
      Object.keys(base).length > 0 ? { order: base } : {};
    const [queued, inProgress, delayed, ready, atRiskCount, issues, delayedOrders] =
      await Promise.all([
        (prisma as unknown as { productionOrder: { count: (a: unknown) => Promise<number> } }).productionOrder.count({
          where: { ...base, status: ProductionOrderStatus.QUEUED },
        }),
        (prisma as unknown as { productionOrder: { count: (a: unknown) => Promise<number> } }).productionOrder.count({
          where: { ...base, status: ProductionOrderStatus.IN_PROGRESS },
        }),
        (prisma as unknown as { productionOrder: { count: (a: unknown) => Promise<number> } }).productionOrder.count({
          where: {
            ...base,
            status: {
              in: [
                ProductionOrderStatus.IN_PROGRESS,
                ProductionOrderStatus.QUEUED,
              ],
            },
            deadline: { not: null, lt: new Date() },
          },
        }),
        (prisma as unknown as { productionOrder: { count: (a: unknown) => Promise<number> } }).productionOrder.count({
          where: { ...base, status: ProductionOrderStatus.COMPLETED },
        }),
        (prisma as unknown as { productionOrder: { count: (a: unknown) => Promise<number> } }).productionOrder.count({
          where: { ...base, atRisk: true },
        }),
        hasProductionIssue
          ? (prisma as unknown as { productionIssue: { findMany: (a: unknown) => Promise<{ id: string; description: string; orderId: string }[]> } }).productionIssue.findMany({
              where: {
                status: ProductionIssueStatus.OPEN,
                ...issueOrderFilter,
              },
              take: 5,
              select: {
                id: true,
                description: true,
                orderId: true,
              },
            })
          : Promise.resolve([]),
        (prisma as unknown as { productionOrder: { findMany: (a: unknown) => Promise<{ id: string; deadline: Date | null; deal: { title: string } }[]> } }).productionOrder.findMany({
          where: {
            ...base,
            deadline: { not: null, lt: new Date() },
            status: {
              notIn: [
                ProductionOrderStatus.COMPLETED,
                ProductionOrderStatus.CANCELED,
              ],
            },
          },
          take: 5,
          orderBy: { deadline: "asc" },
          select: {
            id: true,
            deadline: true,
            deal: { select: { title: true } },
          },
        }),
      ]);

    const active = queued + inProgress;
    const denom = Math.max(1, active + ready);
    const loadPct = Math.min(100, Math.round((active / denom) * 100));
    const ringPct = Math.min(
      100,
      Math.round(
        (inProgress / Math.max(1, queued + inProgress)) * 100,
      ),
    );

    return {
      queued,
      inProgress,
      delayed,
      ready,
      loadPct,
      ringPct,
      atRiskCount,
      issues: issues.map((i) => ({
        id: i.id,
        title: i.description.slice(0, 80),
        orderId: i.orderId,
      })),
      delayedOrders,
    };
  }

  const wf = prodWhere ?? {};
  const issueFlowFilter =
    Object.keys(wf).length > 0 ? { flow: wf } : {};

  const [queued, inProgress, delayed, ready, atRiskCount, risks, delayedFlows] =
    await Promise.all([
      prisma.productionFlow.count({
        where: {
          ...wf,
          status: {
            in: [
              ProductionFlowStatus.NEW,
              ProductionFlowStatus.ON_HOLD,
              ProductionFlowStatus.BLOCKED,
            ],
          },
        },
      }),
      prisma.productionFlow.count({
        where: {
          ...wf,
          status: {
            in: [
              ProductionFlowStatus.ACTIVE,
              ProductionFlowStatus.READY_FOR_PROCUREMENT_AND_WORKSHOP,
              ProductionFlowStatus.IN_WORKSHOP,
              ProductionFlowStatus.READY_FOR_INSTALLATION,
            ],
          },
        },
      }),
      prisma.productionFlow.count({
        where: {
          ...wf,
          dueDate: { not: null, lt: new Date() },
          status: {
            notIn: [ProductionFlowStatus.DONE, ProductionFlowStatus.CANCELLED],
          },
        },
      }),
      prisma.productionFlow.count({
        where: { ...wf, status: ProductionFlowStatus.DONE },
      }),
      prisma.productionFlow.count({
        where: { ...(prodWhere ?? {}), riskScore: { gte: 70 } },
      }),
      prisma.productionRisk.findMany({
        where: {
          resolvedAt: null,
          severity: {
            in: [ProductionRiskSeverity.HIGH, ProductionRiskSeverity.CRITICAL],
          },
          ...issueFlowFilter,
        },
        take: 5,
        select: {
          id: true,
          title: true,
          description: true,
          flowId: true,
        },
      }),
      prisma.productionFlow.findMany({
        where: {
          ...wf,
          dueDate: { not: null, lt: new Date() },
          status: {
            notIn: [ProductionFlowStatus.DONE, ProductionFlowStatus.CANCELLED],
          },
        },
        take: 5,
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          dueDate: true,
          deal: { select: { title: true } },
        },
      }),
    ]);

  const active = queued + inProgress;
  const denom = Math.max(1, active + ready);
  const loadPct = Math.min(100, Math.round((active / denom) * 100));
  const ringPct = Math.min(
    100,
    Math.round(
      (inProgress / Math.max(1, queued + inProgress)) * 100,
    ),
  );

  return {
    queued,
    inProgress,
    delayed,
    ready,
    loadPct,
    ringPct,
    atRiskCount,
    issues: risks.map((i) => ({
      id: i.id,
      title: (i.title || i.description).slice(0, 80),
      orderId: i.flowId,
    })),
    delayedOrders: delayedFlows.map((o) => ({
      id: o.id,
      deadline: o.dueDate,
      deal: { title: o.deal.title },
    })),
  };
}

async function loadProductionOverview(
  prodWhere: Prisma.ProductionFlowWhereInput | undefined,
  now: Date,
): Promise<ProductionOverview> {
  const s = await loadProductionStats(prodWhere);
  return {
    queued: s.queued,
    inProgress: s.inProgress,
    delayed: s.delayed,
    readyForDelivery: s.ready,
    workerLoadPct: s.loadPct,
    progressRingPct: s.ringPct,
    topDelayed: s.delayedOrders.map((o) => ({
      id: o.id,
      dealTitle: o.deal.title,
      deadline: o.deadline ? o.deadline.toISOString() : null,
      daysLate: o.deadline
        ? Math.max(0, Math.floor((+now - +o.deadline) / 86400000))
        : 0,
    })),
    urgentIssues: s.issues,
  };
}

async function loadProcurementOverview(
  dealWhere: Prisma.DealWhereInput | undefined,
): Promise<ProcurementOverview> {
  if (!hasDealPurchaseOrder) {
    const stockLow = hasStockItem
      ? await (prisma as unknown as { stockItem: { count: (a: unknown) => Promise<number> } }).stockItem.count({
          where: {
            quantity: { lte: new Prisma.Decimal("5") },
          },
        })
      : 0;
    return {
      pendingOrders: 0,
      supplierDelays: 0,
      lowStockMaterials: stockLow,
      deliveriesThisWeek: 0,
    };
  }

  const dealFilter = dealWhere ? { deal: { is: dealWhere } } : {};
  const weekEnd = endOfDay(subDays(new Date(), -7));
  const dpo = (prisma as unknown as { dealPurchaseOrder: { count: (a: unknown) => Promise<number> } }).dealPurchaseOrder;

  const [pending, delays, stockLow, weekDel] = await Promise.all([
    dpo.count({
      where: {
        ...dealFilter,
        status: {
          in: [DealPurchaseOrderStatus.DRAFT, DealPurchaseOrderStatus.ORDERED],
        },
      },
    }),
    dpo.count({
      where: {
        ...dealFilter,
        status: DealPurchaseOrderStatus.ORDERED,
        expectedDate: { lt: new Date() },
      },
    }),
    hasStockItem
      ? (prisma as unknown as { stockItem: { count: (a: unknown) => Promise<number> } }).stockItem.count({
          where: {
            quantity: { lte: new Prisma.Decimal("5") },
          },
        })
      : Promise.resolve(0),
    dpo.count({
      where: {
        ...dealFilter,
        expectedDate: { lte: weekEnd, gte: new Date() },
      },
    }),
  ]);

  return {
    pendingOrders: pending,
    supplierDelays: delays,
    lowStockMaterials: stockLow,
    deliveriesThisWeek: weekDel,
  };
}

async function loadSchedulePreview(
  access: SessionAccess,
  perms: ExecutiveDashboardPerms,
  _role: EffectiveRole,
): Promise<SchedulePreview | null> {
  if (!perms.calendarView) return null;
  const ctx = access.ctx;
  const calScope = calendarEventWhere(ctx);
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const events = await prisma.calendarEvent.findMany({
    where: {
      ...(calScope ?? {}),
      status: { not: CalendarEventStatus.CANCELED },
      startAt: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startAt: "asc" },
    take: 24,
    include: {
      lead: { select: { id: true, title: true } },
    },
  });

  const today: ScheduleItem[] = events.map((ev) => ({
    id: ev.id,
    time: format(ev.startAt, "HH:mm", { locale: uk }),
    title: ev.title,
    type: mapCalType(ev.type),
    context: ev.lead?.title
      ? `Лід: ${ev.lead.title}`
      : ev.location ?? "",
    href: ev.leadId ? `/leads/${ev.leadId}` : "/calendar",
  }));

  const upcoming = await prisma.calendarEvent.findFirst({
    where: {
      ...(calScope ?? {}),
      status: { not: CalendarEventStatus.CANCELED },
      startAt: { gt: now },
    },
    orderBy: { startAt: "asc" },
    include: { lead: { select: { id: true, title: true } } },
  });

  let nextEvent: ScheduleItem | null = null;
  if (upcoming) {
    nextEvent = {
      id: upcoming.id,
      time: format(upcoming.startAt, "d MMM HH:mm", { locale: uk }),
      title: upcoming.title,
      type: mapCalType(upcoming.type),
      context: upcoming.lead?.title ?? "",
      href: upcoming.leadId
        ? `/leads/${upcoming.leadId}`
        : "/calendar",
    };
  }

  const sessionUser = sessionUserFromAccess(access);
  const taskScope = await taskListWhereForUser(prisma, sessionUser);
  const overdueTasks = perms.tasksView
    ? await prisma.task.count({
        where: {
          AND: [
            taskScope,
            {
              status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
              dueAt: { not: null, lt: now },
            },
          ],
        },
      })
    : 0;

  return { today, nextEvent, overdueTasks };
}

function mapCalType(t: CalendarEventType): string {
  switch (t) {
    case CalendarEventType.MEASUREMENT:
      return "Замір";
    case CalendarEventType.INSTALLATION:
      return "Монтаж";
    case CalendarEventType.DELIVERY:
      return "Доставка";
    case CalendarEventType.MEETING:
      return "Зустріч";
    default:
      return "Подія";
  }
}

async function loadRisks(
  dealWhere: Prisma.DealWhereInput,
  prodWhere: Prisma.ProductionFlowWhereInput | undefined,
  now: Date,
): Promise<RiskRow[]> {
  const rows: RiskRow[] = [];

  const dealRiskWhere = (
    hasInvoice
      ? {
          OR: [
            { expectedCloseDate: { not: null, lt: now } },
            {
              invoices: {
                some: { status: CrmInvoiceStatus.SENT },
              },
            },
          ],
        }
      : { expectedCloseDate: { not: null, lt: now } }
  ) as Prisma.DealWhereInput;

  const deals = await prisma.deal.findMany({
    where: {
      AND: [dealWhere, { status: DealStatus.OPEN }, dealRiskWhere],
    },
    take: 20,
    select: {
      id: true,
      title: true,
      expectedCloseDate: true,
      ...(hasInvoice
        ? {
            invoices: {
              where: { status: CrmInvoiceStatus.SENT },
              select: { amount: true },
            },
          }
        : {}),
    },
  });

  for (const d of deals) {
    let score = 30;
    const types: RiskType[] = [];
    if (d.expectedCloseDate && d.expectedCloseDate < now) {
      score += 35;
      types.push("deadline");
    }
    const inv = (d as { invoices?: unknown[] }).invoices;
    if (hasInvoice && inv && inv.length > 0) {
      score += 25;
      types.push("payment");
    }
    if (score < 40) continue;
    rows.push({
      id: `deal-${d.id}`,
      entityType: "deal",
      entityId: d.id,
      name: d.title,
      riskType: types[0] ?? "deadline",
      score: Math.min(100, score),
      reason:
        types.includes("payment") && types.includes("deadline")
          ? "Прострочені очікування та неоплачені рахунки"
          : types.includes("payment")
            ? "Є неоплачені рахунки"
            : "Прострочена дата закриття",
      href: `/deals/${d.id}`,
    });
  }

  if (hasProductionOrder) {
    const prod = await (prisma as unknown as { productionOrder: { findMany: (a: unknown) => Promise<{ id: string; deadline: Date | null; deal: { id: string; title: string } }[]> } }).productionOrder.findMany({
      where: {
        ...(prodWhere as Record<string, unknown>),
        status: {
          notIn: [
            ProductionOrderStatus.COMPLETED,
            ProductionOrderStatus.CANCELED,
          ],
        },
        deadline: { not: null, lt: now },
      },
      take: 10,
      select: {
        id: true,
        deadline: true,
        deal: { select: { id: true, title: true } },
      },
    });

    for (const p of prod) {
      rows.push({
        id: `po-${p.id}`,
        entityType: "production",
        entityId: p.id,
        name: p.deal.title,
        riskType: "production_delay",
        score: 75,
        reason: `Дедлайн виробництва ${p.deadline ? format(p.deadline, "d MMM", { locale: uk }) : "—"}`,
        href: `/crm/production/${p.id}`,
      });
    }
  } else {
    const prod = await prisma.productionFlow.findMany({
      where: {
        ...(prodWhere ?? {}),
        status: {
          notIn: [ProductionFlowStatus.DONE, ProductionFlowStatus.CANCELLED],
        },
        dueDate: { not: null, lt: now },
      },
      take: 10,
      select: {
        id: true,
        dueDate: true,
        deal: { select: { id: true, title: true } },
      },
    });

    for (const p of prod) {
      rows.push({
        id: `po-${p.id}`,
        entityType: "production",
        entityId: p.id,
        name: p.deal.title,
        riskType: "production_delay",
        score: 75,
        reason: `Дедлайн виробництва ${p.dueDate ? format(p.dueDate, "d MMM", { locale: uk }) : "—"}`,
        href: `/crm/production/${p.id}`,
      });
    }
  }

  if (hasDealPurchaseOrder) {
    const sup = await (prisma as unknown as { dealPurchaseOrder: { findMany: (a: unknown) => Promise<{ id: string; orderNumber: string; deal: { id: string; title: string } | null }[]> } }).dealPurchaseOrder.findMany({
      where: {
        deal: { is: dealWhere },
        status: DealPurchaseOrderStatus.ORDERED,
        expectedDate: { not: null, lt: now },
      },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        deal: { select: { id: true, title: true } },
      },
    });

    for (const o of sup) {
      rows.push({
        id: `po-sup-${o.id}`,
        entityType: "procurement",
        entityId: o.id,
        name: o.deal?.title ?? o.orderNumber,
        riskType: "supplier_delay",
        score: 68,
        reason: "Прострочена дата поставки матеріалів",
        href: `/crm/procurement`,
      });
    }
  }

  rows.sort((a, b) => b.score - a.score);
  return rows;
}

async function loadNextActions(
  access: SessionAccess,
  perms: ExecutiveDashboardPerms,
  dealWhere: Prisma.DealWhereInput | undefined,
  submittedHandoffsCount: number,
  metrics: {
    staleLeadsCount: number;
    overdueTasksCount: number;
    productionAtRiskCount: number;
  },
): Promise<NextActionItem[]> {
  const actions: NextActionItem[] = [];

  if (perms.leadsView && metrics.staleLeadsCount > 0) {
    actions.push({
      id: "follow-leads",
      title: "Передзвонити та оновити ліди без руху",
      reason: `${metrics.staleLeadsCount} активних лідів без активності >48 год`,
      urgency: "high",
      ctaLabel: "До лідів",
      href: "/leads",
      entityType: "lead",
    });
  }

  if (perms.dealsView && dealWhere) {
    if (submittedHandoffsCount > 0) {
      actions.push({
        id: "handoff",
        title: "Підтвердити передачу у виробництво",
        reason: `${submittedHandoffsCount} пакет(ів) очікує прийняття`,
        urgency: "high",
        ctaLabel: "Замовлення",
        href: "/deals",
        entityType: "deal",
      });
    }
  }

  if (perms.tasksView && metrics.overdueTasksCount > 0) {
      actions.push({
        id: "tasks",
        title: "Закрити прострочені задачі",
        reason: `${metrics.overdueTasksCount} задач з простроченим дедлайном`,
        urgency: "medium",
        ctaLabel: "Задачі",
        href: "/tasks/overdue",
        entityType: "task",
      });
  }

  if (perms.productionView && metrics.productionAtRiskCount > 0) {
      actions.push({
        id: "prod-risk",
        title: "Перевірити замовлення з позначкою «ризик»",
        reason: `${metrics.productionAtRiskCount} замовлень позначено AI/оператором як ризикові`,
        urgency: "high",
        ctaLabel: "Виробництво",
        href: "/crm/production",
        entityType: "production",
      });
  }

  return actions.slice(0, 12);
}

async function loadTeamPerformance(
  perms: ExecutiveDashboardPerms,
  sessionUser: ReturnType<typeof sessionUserFromAccess>,
  dealWhere: Prisma.DealWhereInput,
  now: Date,
  precomputedOverdueTasks?: number,
): Promise<TeamPerformanceBlock | null> {
  if (!perms.dealsView) return null;

  const taskScope = perms.tasksView
    ? await taskListWhereForUser(prisma, sessionUser)
    : null;

  const [dealGroups, taskGroups, won30] = await Promise.all([
    prisma.deal.groupBy({
      by: ["ownerId"],
      where: { ...dealWhere, status: DealStatus.OPEN },
      _count: { _all: true },
      orderBy: { _count: { ownerId: "desc" } },
      take: 10,
    }),
    taskScope
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
          take: 10,
        })
      : Promise.resolve([]),
    prisma.deal.groupBy({
      by: ["ownerId"],
      where: {
        ...dealWhere,
        status: DealStatus.WON,
        updatedAt: { gte: subDays(now, 30) },
      },
      _count: { _all: true },
    }),
  ]);

  const userIds = new Set<string>();
  for (const g of dealGroups) userIds.add(g.ownerId);
  for (const g of taskGroups) userIds.add(g.assigneeId);

  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, name: true, email: true },
  });
  const nameById = new Map(
    users.map((u) => [u.id, u.name ?? u.email ?? u.id.slice(0, 6)]),
  );

  const wonBy = new Map(won30.map((w) => [w.ownerId, w._count._all]));
  const dealsBy = new Map(dealGroups.map((g) => [g.ownerId, g._count._all]));
  const tasksBy = new Map(
    taskGroups.map((g) => [g.assigneeId, g._count._all]),
  );

  const leaderboard: TeamPerformanceBlock["leaderboard"] = [...userIds].map(
    (id) => ({
      userId: id,
      name: nameById.get(id) ?? id,
      dealsOpen: dealsBy.get(id) ?? 0,
      tasksOpen: tasksBy.get(id) ?? 0,
      conversions30d: wonBy.get(id) ?? 0,
    }),
  );
  leaderboard.sort(
    (a, b) =>
      b.dealsOpen + b.conversions30d - (a.dealsOpen + a.conversions30d),
  );

  const dealsInWork = dealGroups.reduce((s, g) => s + g._count._all, 0);
  const tasksOverdue =
    precomputedOverdueTasks ??
    (taskScope
      ? await prisma.task.count({
          where: {
            AND: [
              taskScope,
              {
                status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
                dueAt: { not: null, lt: now },
              },
            ],
          },
        })
      : 0);

  const totalWon = [...wonBy.values()].reduce((s, n) => s + n, 0);
  const avgConversionPct =
    leaderboard.length > 0 && dealsInWork + totalWon > 0
      ? Math.round((totalWon / (dealsInWork + totalWon)) * 1000) / 10
      : null;

  return {
    leaderboard: leaderboard.slice(0, 8),
    dealsInWork,
    avgConversionPct,
    responseSpeedHours: null,
    tasksOverdue,
  };
}

function buildDirectorAiStub(mode: "measurer"): DirectorAiBlock {
  if (mode === "measurer") {
    return {
      summaryLines: [
        "Ваш фокус — календар замірів і якість комунікації з клієнтом.",
        "Перевірте найближчі події та підготуйте документи до виїзду.",
      ],
      problems: [],
      recommendations: [
        {
          action: "Синхронізувати час із клієнтом за день до виїзду",
          ownerHint: "Замірник",
          priority: "medium",
        },
      ],
      forecast: {
        revenue: "Н/Д для ролі замірника",
        risks: "Прострочені задачі з замірами — у блоці розкладу",
        bottlenecks: "—",
      },
    };
  }
  return {
    summaryLines: [],
    problems: [],
    recommendations: [],
    forecast: { revenue: "—", risks: "—", bottlenecks: "—" },
  };
}

function buildDirectorAi(input: {
  revWork: number;
  paidM: number;
  expected: number;
  grossForecast: number;
  activeLeads: number;
  risks: RiskRow[];
  nextActions: NextActionItem[];
  finance: FinanceOverview | null;
  production: ProductionOverview | null;
}): DirectorAiBlock {
  const lines = [
    `Операційний зріз: у роботі ≈ ${formatUah(input.revWork)} у відкритих замовленнях, сплачено цього місяця ≈ ${formatUah(input.paidM)}.`,
    `Активних лідів: ${input.activeLeads}; очікувані надходження по рахунках ≈ ${formatUah(input.expected)}.`,
    `Грубий прогноз валового по відкритих замовленнях: ≈ ${formatUah(input.grossForecast)} (залежить від повноти смет і закупівель).`,
  ];

  const problems: DirectorAiBlock["problems"] = [];
  if (input.finance && input.finance.paymentsOverdue > 0) {
    problems.push({
      label: "Касовий ризик",
      detail: `Є прострочені очікування оплат ≈ ${formatUah(input.finance.paymentsOverdue)}.`,
    });
  }
  if (input.risks.filter((r) => r.riskType === "production_delay").length > 0) {
    problems.push({
      label: "Виробництво",
      detail: "Є замовлення з простроченими дедлайнами — перевірте чергу.",
    });
  }
  if (input.activeLeads > 40) {
    problems.push({
      label: "Воронка",
      detail: "Висока кількість активних лідів — ризик втрати швидкості відповіді.",
    });
  }

  const recommendations: DirectorAiBlock["recommendations"] =
    input.nextActions.slice(0, 5).map((a) => ({
      action: a.title,
      ownerHint:
        a.entityType === "lead"
          ? "Продажі"
          : a.entityType === "production"
            ? "Виробництво"
            : "Відповідальний з задачі",
      priority: a.urgency,
    }));

  return {
    summaryLines: lines,
    problems,
    recommendations,
    forecast: {
      revenue: `Очікуване накопичення по відкритих замовленнях: ≈ ${formatUah(input.revWork)} (не факт кешу).`,
      risks:
        input.risks.length > 0
          ? `Топ-ризик: ${input.risks[0]?.name ?? "—"} (${input.risks[0]?.score ?? 0}/100).`
          : "Критичних ризиків у видимості не виявлено.",
      bottlenecks:
        input.production && input.production.delayed > 0
          ? `${input.production.delayed} виробничих замовлень з простроченим дедлайном.`
          : "Вузькі місця краще уточнити на нараді з виробництвом.",
    },
  };
}
