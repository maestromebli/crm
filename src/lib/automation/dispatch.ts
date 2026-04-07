import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { executeAutomationRule } from "./engine";

/**
 * Заглушка автоматизації: для увімкнених правил з відповідним trigger створює запис AutomationRun.
 * Граф виконання (graphJson) поки не інтерпретується — статус SKIPPED.
 */
export async function dispatchDealAutomationTrigger(input: {
  dealId: string;
  trigger: string;
  payload?: Prisma.InputJsonValue;
  startedById?: string | null;
}): Promise<void> {
  await dispatchAutomationTrigger({
    trigger: input.trigger,
    payload: {
      entity: "deal",
      dealId: input.dealId,
      ...(typeof input.payload === "object" &&
      input.payload !== null &&
      !Array.isArray(input.payload)
        ? input.payload
        : {}),
    },
    startedById: input.startedById,
  });
}

/** Тригери з контекстом ліда (§9.1). */
export async function dispatchLeadAutomationTrigger(input: {
  leadId: string;
  trigger: string;
  payload?: Prisma.InputJsonValue;
  startedById?: string | null;
}): Promise<void> {
  await dispatchAutomationTrigger({
    trigger: input.trigger,
    payload: {
      entity: "lead",
      leadId: input.leadId,
      ...(typeof input.payload === "object" &&
      input.payload !== null &&
      !Array.isArray(input.payload)
        ? input.payload
        : {}),
    },
    startedById: input.startedById,
  });
}

export async function dispatchConversionAutomationTrigger(input: {
  leadId: string;
  dealId: string;
  trigger: string;
  payload?: Prisma.InputJsonValue;
  startedById?: string | null;
}): Promise<void> {
  await dispatchAutomationTrigger({
    trigger: input.trigger,
    payload: {
      entity: "conversion",
      leadId: input.leadId,
      dealId: input.dealId,
      ...(typeof input.payload === "object" &&
      input.payload !== null &&
      !Array.isArray(input.payload)
        ? input.payload
        : {}),
    },
    startedById: input.startedById,
  });
}

async function dispatchAutomationTrigger(input: {
  trigger: string;
  payload?: Prisma.InputJsonValue;
  startedById?: string | null;
}): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return;
  try {
    const rules = await prisma.automationRule.findMany({
      where: { enabled: true, trigger: input.trigger },
    });
    const payloadObject =
      input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
        ? (input.payload as Record<string, unknown>)
        : {};
    const dealId =
      typeof payloadObject.dealId === "string" ? payloadObject.dealId : null;
    for (const rule of rules) {
      const run = await prisma.automationRun.create({
        data: {
          ruleId: rule.id,
          triggerKey: input.trigger,
          status: "PENDING",
          payload: input.payload ?? undefined,
          startedById: input.startedById ?? undefined,
        },
      });
      const startedAt = new Date();
      const result = dealId
        ? await executeAutomationRule({
            ruleId: rule.id,
            dealId,
            payload: payloadObject,
          })
        : { status: "SKIPPED" as const };
      await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: result.status,
          error: result.error ?? null,
          startedAt,
          finishedAt: new Date(),
        },
      });
    }
  } catch (e) {
     
    console.error("[dispatchAutomationTrigger]", e);
  }
}
