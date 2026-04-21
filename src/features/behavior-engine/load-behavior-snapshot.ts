import { DealStatus, TaskStatus, type Prisma } from "@prisma/client";
import { subDays } from "date-fns";
import { prisma } from "../../lib/prisma";
import type { BehaviorEngineSnapshot } from "../crm-dashboard/executive-types";

type ScoreMetrics = {
  firstContactDiscipline: number;
  followUpDiscipline: number;
  leadVelocity: number;
  dealMovement: number;
  managerResponsiveness: number;
  conversionHygiene: number;
};

type LoadBehaviorSnapshotInput = {
  now: Date;
  leadWhere: Prisma.LeadWhereInput;
  dealWhere: Prisma.DealWhereInput;
  taskWhere: Prisma.TaskWhereInput;
};

function safeRatio(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, part / total));
}

function toScore(ratio: number): number {
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((acc, v) => acc + v, 0) / values.length);
}

function scoreSignals(metrics: ScoreMetrics): string[] {
  const out: string[] = [];
  if (metrics.firstContactDiscipline < 70) {
    out.push("Слабка дисципліна першого контакту.");
  }
  if (metrics.followUpDiscipline < 70) {
    out.push("Є прострочені follow-up без закриття.");
  }
  if (metrics.dealMovement < 65) {
    out.push("Замовлення рухаються повільно між оновленнями.");
  }
  if (metrics.managerResponsiveness < 65) {
    out.push("Накопичуються прострочені задачі.");
  }
  if (metrics.conversionHygiene < 70) {
    out.push("Багато лідів із неповними обов'язковими даними.");
  }
  return out;
}

function primaryIssue(metrics: ScoreMetrics): string {
  const pairs: Array<[keyof ScoreMetrics, number]> = [
    ["firstContactDiscipline", metrics.firstContactDiscipline],
    ["followUpDiscipline", metrics.followUpDiscipline],
    ["leadVelocity", metrics.leadVelocity],
    ["dealMovement", metrics.dealMovement],
    ["managerResponsiveness", metrics.managerResponsiveness],
    ["conversionHygiene", metrics.conversionHygiene],
  ];
  pairs.sort((a, b) => a[1] - b[1]);
  const weakest = pairs[0]?.[0];
  switch (weakest) {
    case "firstContactDiscipline":
      return "Перший контакт";
    case "followUpDiscipline":
      return "Follow-up";
    case "leadVelocity":
      return "Швидкість руху лідів";
    case "dealMovement":
      return "Рух замовлень";
    case "managerResponsiveness":
      return "Реакція по задачах";
    case "conversionHygiene":
      return "Якість даних ліда";
    default:
      return "Загальна дисципліна";
  }
}

export async function loadBehaviorSnapshot({
  now,
  leadWhere,
  dealWhere,
  taskWhere,
}: LoadBehaviorSnapshotInput): Promise<BehaviorEngineSnapshot> {
  const horizon30d = subDays(now, 30);
  const activeHorizon = subDays(now, 3);
  const dealMoveHorizon = subDays(now, 7);

  const leads = await prisma.lead.findMany({
    where: {
      AND: [
        leadWhere,
        {
          OR: [{ createdAt: { gte: horizon30d } }, { stage: { isFinal: false } }],
        },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      createdAt: true,
      lastActivityAt: true,
      nextContactAt: true,
      contactName: true,
      phone: true,
      source: true,
      stage: { select: { isFinal: true } },
    },
  });

  const deals = await prisma.deal.findMany({
    where: { ...dealWhere, status: DealStatus.OPEN },
    select: {
      id: true,
      ownerId: true,
      updatedAt: true,
    },
  });

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        taskWhere,
        {
          status: {
            in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] as TaskStatus[],
          },
        },
      ],
    },
    select: {
      id: true,
      assigneeId: true,
      dueAt: true,
    },
  });

  const ownerIds = new Set<string>();
  for (const lead of leads) ownerIds.add(lead.ownerId);
  for (const deal of deals) ownerIds.add(deal.ownerId);
  for (const task of tasks) ownerIds.add(task.assigneeId);

  if (ownerIds.size === 0) {
    return {
      teamBehaviorScore: 0,
      managerScores: [],
      weakManagers: [],
      alerts: [],
    };
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...ownerIds] } },
    select: { id: true, name: true, email: true },
  });
  const userNameMap = new Map(
    users.map((u) => [u.id, u.name ?? u.email ?? u.id.slice(0, 8)]),
  );

  const managerScores = [...ownerIds].map((userId) => {
    const myLeads = leads.filter((l) => l.ownerId === userId);
    const myDeals = deals.filter((d) => d.ownerId === userId);
    const myTasks = tasks.filter((t) => t.assigneeId === userId);

    const firstContactCandidates = myLeads.filter((l) => l.createdAt >= horizon30d);
    const firstContactOnTime = firstContactCandidates.filter((l) => {
      if (!l.lastActivityAt) return false;
      return l.lastActivityAt.getTime() - l.createdAt.getTime() <= 24 * 60 * 60 * 1000;
    }).length;
    const firstContactDiscipline = toScore(
      safeRatio(firstContactOnTime, firstContactCandidates.length),
    );

    const scheduledFollowUps = myLeads.filter((l) => l.nextContactAt != null);
    const overdueFollowUps = scheduledFollowUps.filter((l) => {
      if (!l.nextContactAt) return false;
      const noRecentTouch = !l.lastActivityAt || l.lastActivityAt < l.nextContactAt;
      return l.nextContactAt < now && noRecentTouch;
    }).length;
    const followUpDiscipline = toScore(
      1 - safeRatio(overdueFollowUps, Math.max(1, scheduledFollowUps.length)),
    );

    const activeLeads = myLeads.filter((l) => !l.stage.isFinal);
    const movingLeads = activeLeads.filter(
      (l) => l.lastActivityAt && l.lastActivityAt >= activeHorizon,
    ).length;
    const leadVelocity = toScore(safeRatio(movingLeads, Math.max(1, activeLeads.length)));

    const movingDeals = myDeals.filter((d) => d.updatedAt >= dealMoveHorizon).length;
    const dealMovement = toScore(safeRatio(movingDeals, Math.max(1, myDeals.length)));

    const overdueTasks = myTasks.filter((t) => t.dueAt && t.dueAt < now).length;
    const managerResponsiveness = toScore(
      1 - safeRatio(overdueTasks, Math.max(1, myTasks.length)),
    );

    const completeLeads = myLeads.filter(
      (l) => Boolean(l.contactName) && Boolean(l.phone) && Boolean(l.source),
    ).length;
    const conversionHygiene = toScore(safeRatio(completeLeads, Math.max(1, myLeads.length)));

    const managerBehaviorScore = avg([
      firstContactDiscipline,
      followUpDiscipline,
      leadVelocity,
      dealMovement,
      managerResponsiveness,
      conversionHygiene,
    ]);

    const metrics: ScoreMetrics = {
      firstContactDiscipline,
      followUpDiscipline,
      leadVelocity,
      dealMovement,
      managerResponsiveness,
      conversionHygiene,
    };

    return {
      userId,
      name: userNameMap.get(userId) ?? userId,
      firstContactDiscipline,
      followUpDiscipline,
      leadVelocity,
      dealMovement,
      managerResponsiveness,
      conversionHygiene,
      managerBehaviorScore,
      signals: scoreSignals(metrics),
    };
  });

  managerScores.sort((a, b) => b.managerBehaviorScore - a.managerBehaviorScore);
  const weakManagers = managerScores
    .filter((m) => m.managerBehaviorScore < 70)
    .sort((a, b) => a.managerBehaviorScore - b.managerBehaviorScore)
    .slice(0, 5)
    .map((m) => ({
      userId: m.userId,
      name: m.name,
      score: m.managerBehaviorScore,
      primaryIssue: primaryIssue({
        firstContactDiscipline: m.firstContactDiscipline,
        followUpDiscipline: m.followUpDiscipline,
        leadVelocity: m.leadVelocity,
        dealMovement: m.dealMovement,
        managerResponsiveness: m.managerResponsiveness,
        conversionHygiene: m.conversionHygiene,
      }),
    }));

  const alerts = weakManagers.slice(0, 3).map((m) => ({
    id: `behavior-${m.userId}`,
    severity: m.score < 55 ? ("high" as const) : ("medium" as const),
    label: `${m.name}: низька поведінкова дисципліна (${m.score}/100)`,
    detail: `Проблемна зона: ${m.primaryIssue}. Потрібен операційний follow-up.`,
    href: "/crm/dashboard?view=issues",
  }));

  return {
    teamBehaviorScore: avg(managerScores.map((m) => m.managerBehaviorScore)),
    managerScores,
    weakManagers,
    alerts,
  };
}
