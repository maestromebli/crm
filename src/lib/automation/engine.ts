import { prisma } from "@/lib/prisma";
import { createFinanceInvoice } from "@/lib/finance/invoice-payment-service";
import { publishCrmEvent, CRM_EVENT_TYPES } from "@/lib/events/crm-events";

type AutomationCondition = {
  field: string;
  op: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number | string;
};

type AutomationAction =
  | { type: "createTask"; title?: string; description?: string; priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" }
  | { type: "sendNotification"; message: string }
  | { type: "updateStage"; stageId: string }
  | { type: "assignUser"; userId: string }
  | { type: "generateInvoice"; amount?: number; invoiceType?: "PREPAYMENT_70" | "FINAL_30" | "CUSTOM" }
  | { type: "sendMessage"; channel?: string; message: string };

type AutomationGraph = {
  nodes?: Array<{ id: string; type: string; config?: Record<string, unknown> }>;
  connections?: Array<{ from: string; to: string }>;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseGraph(raw: unknown): AutomationGraph {
  const obj = asObject(raw);
  const conditions = Array.isArray(obj.conditions)
    ? (obj.conditions.filter((x) => typeof x === "object" && x) as AutomationCondition[])
    : [];
  const actions = Array.isArray(obj.actions)
    ? (obj.actions.filter((x) => typeof x === "object" && x) as AutomationAction[])
    : [];
  const nodes = Array.isArray(obj.nodes)
    ? (obj.nodes.filter((x) => typeof x === "object" && x) as AutomationGraph["nodes"])
    : [];
  const connections = Array.isArray(obj.connections)
    ? (obj.connections.filter((x) => typeof x === "object" && x) as AutomationGraph["connections"])
    : [];
  return { conditions, actions, nodes, connections };
}

function readPath(payload: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = payload;
  for (const p of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

function matchCondition(
  payload: Record<string, unknown>,
  condition: AutomationCondition,
): boolean {
  const actual = readPath(payload, condition.field);
  if (typeof condition.value === "number") {
    const left = typeof actual === "number" ? actual : Number(actual);
    if (!Number.isFinite(left)) return false;
    switch (condition.op) {
      case "gt":
        return left > condition.value;
      case "gte":
        return left >= condition.value;
      case "lt":
        return left < condition.value;
      case "lte":
        return left <= condition.value;
      case "eq":
        return left === condition.value;
      default:
        return false;
    }
  }
  return String(actual ?? "") === String(condition.value);
}

async function runAction(input: {
  dealId: string;
  action: AutomationAction;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { dealId, action, payload } = input;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  switch (action.type) {
    case "createTask": {
      await prisma.task.create({
        data: {
          title: action.title?.trim() || "Автоматична задача",
          description: action.description ?? "Створено automation-flow.",
          entityType: "DEAL",
          entityId: dealId,
          taskType: "OTHER",
          status: "OPEN",
          priority: action.priority ?? "NORMAL",
          assigneeId: deal?.ownerId ?? null,
          createdById: deal?.ownerId ?? null,
        },
      });
      break;
    }
    case "updateStage": {
      await prisma.deal.update({
        where: { id: dealId },
        data: { stageId: action.stageId },
      });
      await publishCrmEvent({
        type: CRM_EVENT_TYPES.STAGE_CHANGED,
        dealId,
        payload: {
          source: "automation",
          stageId: action.stageId,
        },
      });
      break;
    }
    case "assignUser": {
      await prisma.deal.update({
        where: { id: dealId },
        data: { ownerId: action.userId },
      });
      break;
    }
    case "generateInvoice": {
      const amountRaw = action.amount ?? Number(payload.amount ?? 0);
      const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 0;
      if (amount <= 0) break;
      await createFinanceInvoice({
        dealId,
        amount,
        type: action.invoiceType ?? "CUSTOM",
      });
      break;
    }
    case "sendNotification":
    case "sendMessage": {
      await prisma.activityLog.create({
        data: {
          entityType: "DEAL",
          entityId: dealId,
          type: "DEAL_UPDATED",
          source: "SYSTEM",
          data: {
            action: action.type,
            message: action.message,
            channel: action.type === "sendMessage" ? action.channel ?? "internal" : "internal",
          },
        },
      });
      break;
    }
    default:
      break;
  }
}

export async function executeAutomationRule(input: {
  ruleId: string;
  dealId: string;
  payload: Record<string, unknown>;
}): Promise<{ status: "SUCCESS" | "SKIPPED" | "FAILED"; error?: string }> {
  const rule = await prisma.automationRule.findUnique({
    where: { id: input.ruleId },
    select: { id: true, enabled: true, graphJson: true },
  });
  if (!rule?.enabled) return { status: "SKIPPED" };
  const graph = parseGraph(rule.graphJson);
  const conditions = graph.conditions ?? [];
  const actions = graph.actions ?? [];
  if (actions.length === 0) return { status: "SKIPPED" };

  const passed = conditions.every((c) => matchCondition(input.payload, c));
  if (!passed) return { status: "SKIPPED" };

  try {
    for (const action of actions) {
      await runAction({
        dealId: input.dealId,
        action,
        payload: input.payload,
      });
    }
    return { status: "SUCCESS" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation action failed";
    return { status: "FAILED", error: message };
  }
}
