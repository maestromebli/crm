import {
  DealStatus,
  HandoffStatus,
  LeadProposalStatus,
  Prisma,
  TaskStatus,
} from "@prisma/client";
import {
  endOfDay,
  startOfDay,
  subDays,
  subHours,
} from "date-fns";
import { uk } from "date-fns/locale";
import { format } from "date-fns";
import { prisma } from "../../lib/prisma";
import type { SessionAccess } from "../../lib/authz/session-access";
import { sessionUserFromAccess } from "../../lib/authz/session-access";
import {
  leadWhereForAccess,
  ownerIdWhere,
  type AccessContext,
} from "../../lib/authz/data-scope";
import { hasEffectivePermission, P } from "../../lib/authz/permissions";
import type { DashboardPerms } from "../dashboard/queries";
import { taskListWhereForUser } from "../../lib/tasks/prisma-scope";

export type CrmDashboardPeriod = "today" | "week" | "month";

export type CrmRiskLead = {
  id: string;
  title: string;
  score: number;
  reason: string;
};

export type CrmNextAction = {
  id: string;
  title: string;
  reason: string;
  href: string;
};

export type CrmDashboardAnalytics = {
  period: CrmDashboardPeriod;
  periodLabel: string;
  proposalsSent: number;
  proposalsApproved: number;
  activeLeads: number;
  newLeadsInPeriod: number;
  dealsWonInPeriod: number;
  revenueInPeriod: number;
  trend: Array<{
    label: string;
    leads: number;
    dealsWon: number;
    revenue: number;
  }>;
  staleProposals48h: number;
  leadsNoContact24h: number;
  riskyLeads: CrmRiskLead[];
  nextBestActions: CrmNextAction[];
};

function periodRange(
  period: CrmDashboardPeriod,
  now: Date,
): { start: Date; end: Date } {
  const end = endOfDay(now);
  switch (period) {
    case "today":
      return { start: startOfDay(now), end };
    case "week":
      return { start: startOfDay(subDays(now, 6)), end };
    case "month":
      return { start: startOfDay(subDays(now, 29)), end };
    default:
      return { start: startOfDay(subDays(now, 6)), end };
  }
}

function periodLabelUk(period: CrmDashboardPeriod): string {
  switch (period) {
    case "today":
      return "сьогодні";
    case "week":
      return "останні 7 днів";
    case "month":
      return "останні 30 днів";
    default:
      return "період";
  }
}

function dealScopeWhere(ctx: AccessContext): Prisma.DealWhereInput | undefined {
  const ow = ownerIdWhere(ctx);
  return ow ? { ownerId: ow } : undefined;
}

export async function loadCrmDashboardAnalytics(
  access: SessionAccess,
  perms: DashboardPerms,
  period: CrmDashboardPeriod,
): Promise<CrmDashboardAnalytics> {
  const empty: CrmDashboardAnalytics = {
    period,
    periodLabel: periodLabelUk(period),
    proposalsSent: 0,
    proposalsApproved: 0,
    activeLeads: 0,
    newLeadsInPeriod: 0,
    dealsWonInPeriod: 0,
    revenueInPeriod: 0,
    trend: [],
    staleProposals48h: 0,
    leadsNoContact24h: 0,
    riskyLeads: [],
    nextBestActions: [],
  };

  if (!process.env.DATABASE_URL?.trim()) {
    return empty;
  }

  const ctx = access.ctx;
  const leadWhere = leadWhereForAccess(ctx);
  const dealWhere = dealScopeWhere(ctx);
  const now = new Date();
  const { start: rangeStart, end: rangeEnd } = periodRange(period, now);
  const permCtx = {
    realRole: access.realRole,
    impersonatorId: access.impersonatorId,
  };
  const canRevenue =
    hasEffectivePermission(access.permissionKeys, P.PAYMENTS_VIEW, permCtx) ||
    hasEffectivePermission(access.permissionKeys, P.DEALS_VIEW, permCtx);

  try {
    const h24 = subHours(now, 24);
    const h48 = subHours(now, 48);

    const leadRelation = leadWhere ? { is: leadWhere } : undefined;

    const [
      proposalsSent,
      proposalsApproved,
      activeLeads,
      newLeadsInPeriod,
      dealsWonRows,
      staleProposals48h,
      leadsNoContact24h,
      handoffSubmitted,
    ] = await Promise.all([
      perms.leadsView
        ? prisma.leadProposal.count({
            where: {
              lead: leadRelation,
              sentAt: { gte: rangeStart, lte: rangeEnd },
            },
          })
        : Promise.resolve(0),
      perms.leadsView
        ? prisma.leadProposal.count({
            where: {
              status: LeadProposalStatus.APPROVED,
              approvedAt: { gte: rangeStart, lte: rangeEnd },
              lead: leadRelation,
            },
          })
        : Promise.resolve(0),
      perms.leadsView
        ? prisma.lead.count({
            where: {
              ...leadWhere,
              stage: { isFinal: false },
            },
          })
        : Promise.resolve(0),
      perms.leadsView
        ? prisma.lead.count({
            where: {
              ...leadWhere,
              createdAt: { gte: rangeStart, lte: rangeEnd },
            },
          })
        : Promise.resolve(0),
      perms.dealsView
        ? prisma.deal.findMany({
            where: {
              ...dealWhere,
              status: DealStatus.WON,
              updatedAt: { gte: rangeStart, lte: rangeEnd },
            },
            select: { value: true, currency: true },
          })
        : Promise.resolve([]),
      perms.leadsView
        ? prisma.leadProposal.count({
            where: {
              lead: leadRelation,
              OR: [
                {
                  status: {
                    in: [
                      LeadProposalStatus.SENT,
                      LeadProposalStatus.CLIENT_REVIEWING,
                    ],
                  },
                  sentAt: { lt: h48 },
                },
                {
                  status: LeadProposalStatus.READY_TO_SEND,
                  updatedAt: { lt: h48 },
                },
              ],
            },
          })
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
              stage: { isFinal: false },
            },
          })
        : Promise.resolve(0),
      perms.dealsView
        ? prisma.dealHandoff.count({
            where: {
              status: HandoffStatus.SUBMITTED,
              deal: dealWhere ? { is: dealWhere } : undefined,
            },
          })
        : Promise.resolve(0),
    ]);

    const dealsWonInPeriod = dealsWonRows.length;
    const revenueInPeriod = canRevenue
      ? dealsWonRows.reduce((s, d) => s + (d.value ?? 0), 0)
      : 0;

    const trendDays = period === "month" ? 10 : 7;
    const trend: CrmDashboardAnalytics["trend"] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const day = startOfDay(subDays(now, i));
      const dayEnd = endOfDay(day);
      const [lc, dw] = await Promise.all([
        perms.leadsView
          ? prisma.lead.count({
              where: {
                ...leadWhere,
                createdAt: { gte: day, lte: dayEnd },
              },
            })
          : Promise.resolve(0),
        perms.dealsView
          ? prisma.deal.findMany({
              where: {
                ...dealWhere,
                status: DealStatus.WON,
                updatedAt: { gte: day, lte: dayEnd },
              },
              select: { value: true },
            })
          : Promise.resolve([]),
      ]);
      const rev = canRevenue
        ? dw.reduce((s, x) => s + (x.value ?? 0), 0)
        : 0;
      trend.push({
        label: format(day, "d MMM", { locale: uk }),
        leads: lc,
        dealsWon: dw.length,
        revenue: rev,
      });
    }

    const riskyRows = perms.leadsView
      ? await prisma.lead.findMany({
          where: {
            ...leadWhere,
            stage: { isFinal: false },
            OR: [
              { lastActivityAt: null },
              { lastActivityAt: { lt: subHours(now, 48) } },
            ],
          },
          orderBy: { updatedAt: "asc" },
          take: 8,
          select: {
            id: true,
            title: true,
            lastActivityAt: true,
            stage: { select: { name: true } },
          },
        })
      : [];

    const riskyLeads: CrmRiskLead[] = riskyRows.map((r) => {
      const stale = !r.lastActivityAt || r.lastActivityAt < subHours(now, 48);
      return {
        id: r.id,
        title: r.title,
        score: stale ? 70 : 40,
        reason: stale
          ? "немає активності >48 год"
          : `застряг на «${r.stage.name}»`,
      };
    });

    const nextBestActions: CrmNextAction[] = [];
    if (leadsNoContact24h > 0) {
      nextBestActions.push({
        id: "nc24",
        title: "Передзвонити лідам без контакту",
        reason: `${leadsNoContact24h} лід(ів) без активності >24 год`,
        href: "/leads",
      });
    }
    if (staleProposals48h > 0) {
      nextBestActions.push({
        id: "kp48",
        title: "Перевірити КП без руху",
        reason: `${staleProposals48h} КП: надіслані без відповіді або «готове до надсилання» >48 год`,
        href: "/leads",
      });
    }
    if (perms.tasksView) {
      const sessionUser = sessionUserFromAccess(access);
      const taskScope = await taskListWhereForUser(prisma, sessionUser);
      const overdue = await prisma.task.count({
        where: {
          AND: [
            taskScope,
            {
              status: {
                in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS],
              },
              dueAt: { not: null, lt: now },
            },
          ],
        },
      });
      if (overdue > 0) {
        nextBestActions.push({
          id: "tasks-od",
          title: "Закрити прострочені задачі",
          reason: `${overdue} задач з простроченим дедлайном`,
          href: "/tasks/overdue",
        });
      }
    }
    if (perms.dealsView && handoffSubmitted > 0) {
      nextBestActions.push({
        id: "handoff",
        title: "Підтвердити передачу у виробництво",
        reason: `${handoffSubmitted} передач очікує підтвердження`,
        href: "/deals",
      });
    }

    return {
      period,
      periodLabel: periodLabelUk(period),
      proposalsSent,
      proposalsApproved,
      activeLeads,
      newLeadsInPeriod,
      dealsWonInPeriod,
      revenueInPeriod,
      trend,
      staleProposals48h,
      leadsNoContact24h,
      riskyLeads,
      nextBestActions,
    };
  } catch {
    return empty;
  }
}
