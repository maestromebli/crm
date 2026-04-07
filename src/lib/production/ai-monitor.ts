import type { Prisma, PrismaClient } from "@prisma/client";

export type ProductionAiInsights = {
  riskScore: number;
  delayPrediction?: string;
  overloadHints: string[];
  redistribution: string[];
  warnings: string[];
  updatedAt: string;
};

function countOpenTasksForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<number> {
  return prisma.productionTask.count({
    where: {
      assignedToId: userId,
      status: { in: ["TODO", "IN_PROGRESS"] },
    },
  });
}

/**
 * Евристики без зовнішнього LLM: SLA, черга задач, прострочені дедлайни.
 */
export async function recomputeOrderRiskAndAi(
  prisma: PrismaClient,
  orderId: string,
): Promise<ProductionAiInsights> {
  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
      tasks: {
        where: { status: { in: ["TODO", "IN_PROGRESS"] } },
        select: { id: true, assignedToId: true, deadline: true },
      },
      issues: { where: { status: "OPEN" } },
      deal: {
        select: {
          title: true,
          client: { select: { name: true } },
        },
      },
    },
  });

  const now = new Date();
  const warnings: string[] = [];
  const overloadHints: string[] = [];
  const redistribution: string[] = [];
  let riskScore = 0;

  if (!order) {
    return {
      riskScore: 0,
      overloadHints,
      redistribution,
      warnings: ["Замовлення не знайдено"],
      updatedAt: now.toISOString(),
    };
  }

  if (order.deadline && order.deadline < now && order.status !== "COMPLETED") {
    riskScore += 40;
    warnings.push("Дедлайн замовлення прострочено — потрібен перегляд плану.");
  }

  for (const t of order.tasks) {
    if (t.deadline && t.deadline < now) {
      riskScore += 15;
      warnings.push("Є прострочені виробничі задачі.");
      break;
    }
  }

  if (order.issues.length > 0) {
    riskScore += Math.min(30, order.issues.length * 10);
    warnings.push(`Відкриті інциденти: ${order.issues.length}.`);
  }

  const doneStages = order.stages.filter((s) => s.status === "DONE").length;
  const totalStages = order.stages.length || 1;
  const pace = doneStages / totalStages;
  if (order.deadline && order.status === "IN_PROGRESS") {
    const totalMs = order.deadline.getTime() - order.createdAt.getTime();
    const elapsed = now.getTime() - order.createdAt.getTime();
    if (totalMs > 0 && pace < elapsed / totalMs - 0.15) {
      riskScore += 20;
      warnings.push("Темп етапів відстає від графіка до дедлайну.");
    }
  }

  riskScore = Math.min(100, riskScore);

  const assignees = [
    ...new Set(order.tasks.map((t) => t.assignedToId).filter(Boolean)),
  ] as string[];
  for (const uid of assignees.slice(0, 8)) {
    const n = await countOpenTasksForUser(prisma, uid);
    if (n >= 8) {
      overloadHints.push(`Користувач має ${n} відкритих виробничих задач — ризик перевантаження.`);
      redistribution.push("Розгляньте перерозподіл частини задач на іншого виконавця.");
    }
  }

  const delayPrediction =
    riskScore >= 50
      ? "Ймовірність зриву дедлайну: висока (енергетика навантаження / інциденти)."
      : riskScore >= 25
        ? "Ймовірність зриву дедлайну: середня — варто прискорити критичні етапи."
        : "Ймовірність зриву дедлайну: низька за поточними сигналами.";

  const insights: ProductionAiInsights = {
    riskScore,
    delayPrediction,
    overloadHints,
    redistribution,
    warnings,
    updatedAt: now.toISOString(),
  };

  const atRisk = riskScore >= 35 || Boolean(order.deadline && order.deadline < now);

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: {
      atRisk,
      aiInsightsJson: insights as unknown as Prisma.InputJsonValue,
    },
  });

  return insights;
}

export async function insightsForOrder(
  prisma: PrismaClient,
  orderId: string,
): Promise<ProductionAiInsights> {
  const row = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    select: { aiInsightsJson: true },
  });
  if (row?.aiInsightsJson && typeof row.aiInsightsJson === "object") {
    return row.aiInsightsJson as ProductionAiInsights;
  }
  return recomputeOrderRiskAndAi(prisma, orderId);
}
