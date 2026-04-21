import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AiContextName =
  | "lead"
  | "deal"
  | "finance"
  | "procurement"
  | "production"
  | "dashboard";

export type AiAction =
  | { type: "createTask"; payload: { title: string; description?: string } }
  | { type: "updateStage"; payload: { stageId: string } }
  | { type: "generateQuote"; payload: Record<string, unknown> }
  | { type: "generateInvoice"; payload: { amount: number } }
  | { type: "sendReminder"; payload: { message: string } };

export type AiContextResult = {
  insights: string[];
  risks: string[];
  recommendations: string[];
  actions: AiAction[];
};

export async function buildAiContextResult(input: {
  context: AiContextName;
  dealId?: string;
  leadId?: string;
}): Promise<AiContextResult> {
  const result: AiContextResult = {
    insights: [],
    risks: [],
    recommendations: [],
    actions: [],
  };

  if (input.context === "deal" && input.dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: input.dealId },
      include: {
        stage: true,
        contract: true,
        dealPaymentPlan: true,
        productionFlow: { select: { id: true } },
        _count: { select: { estimates: true, dealPurchaseOrders: true } },
      },
    });
    if (!deal) return result;
    result.insights.push(`Deal stage: ${deal.stage.name}`);
    result.insights.push(`Estimates count: ${deal._count.estimates}`);
    if (deal.contract?.status !== "FULLY_SIGNED") {
      result.risks.push("Contract is not fully signed.");
      result.recommendations.push("Complete contract signing before production.");
      result.actions.push({
        type: "createTask",
        payload: {
          title: "Контроль підписання договору",
          description: "AI: Договір ще не підписаний повністю.",
        },
      });
    }
    if (deal._count.dealPurchaseOrders === 0 && !deal.productionFlow) {
      result.recommendations.push("Prepare procurement flow after payment milestone 70%.");
    }
  }

  if (input.context === "finance" && input.dealId) {
    const tx = await prisma.moneyTransaction.findMany({
      where: { dealId: input.dealId, type: "INCOME", status: "PAID" },
      select: { amount: true },
    });
    const total = tx.reduce((sum, row) => sum + Number(row.amount), 0);
    result.insights.push(`Paid amount total: ${total.toFixed(2)}`);
    if (total <= 0) {
      result.risks.push("No incoming payments recorded.");
      result.actions.push({
        type: "sendReminder",
        payload: { message: "Нагадування клієнту про передоплату." },
      });
    }
  }

  if (input.context === "production" && input.dealId) {
    const order = await prisma.productionFlow.findUnique({
      where: { dealId: input.dealId },
      select: { id: true, status: true, riskScore: true },
    });
    if (!order) {
      result.recommendations.push("Production order is not created yet.");
      result.actions.push({
        type: "createTask",
        payload: { title: "Запустити виробництво" },
      });
    } else {
      result.insights.push(`Production status: ${order.status}`);
      if (order.riskScore >= 60) {
        result.risks.push("Production flow marked as high risk.");
        result.recommendations.push(
          "Production flow має високий ризик — перевірте причини затримки та план ескалації.",
        );
      }
    }
  }

  if (input.context === "dashboard") {
    const overdue = await prisma.task.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        dueAt: { lt: new Date() },
      },
    });
    result.insights.push(`Overdue tasks: ${overdue}`);
    if (overdue > 0) {
      result.risks.push("Operational backlog detected.");
      result.recommendations.push("Prioritize overdue deal tasks today.");
    }
  }

  return result;
}

export async function executeAiAction(input: {
  dealId: string;
  action: AiAction;
}): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: input.dealId },
    select: { ownerId: true },
  });
  switch (input.action.type) {
    case "createTask":
      await prisma.task.create({
        data: {
          title: input.action.payload.title,
          description: input.action.payload.description ?? null,
          entityType: "DEAL",
          entityId: input.dealId,
          taskType: "OTHER",
          status: "OPEN",
          priority: "NORMAL",
          assigneeId: deal?.ownerId ?? null,
          createdById: deal?.ownerId ?? null,
        },
      });
      break;
    case "updateStage":
      await prisma.deal.update({
        where: { id: input.dealId },
        data: { stageId: input.action.payload.stageId },
      });
      break;
    case "generateInvoice":
      await prisma.invoice.create({
        data: {
          dealId: input.dealId,
          amount: input.action.payload.amount,
          type: "CUSTOM",
          status: "DRAFT",
        },
      });
      break;
    case "sendReminder":
    case "generateQuote":
      await prisma.activityLog.create({
        data: {
          entityType: "DEAL",
          entityId: input.dealId,
          type: "DEAL_UPDATED",
          source: "SYSTEM",
          data: {
            aiAction: input.action.type,
            payload: input.action.payload,
          } as Prisma.InputJsonValue,
        },
      });
      break;
    default:
      break;
  }
}
