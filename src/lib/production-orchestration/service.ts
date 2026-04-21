import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HandoffStatus } from "@prisma/client";
import { appendActivityLog } from "@/lib/deal-api/audit";
import {
  acceptFlowByChief,
  assignConstructor,
  createProductionFlowFromDealHandoff,
  addFlowQuestion,
} from "@/features/production/server/services/production-flow.service";

export async function generateUniqueProductionNumber(
  prisma: PrismaClient,
): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const n = `ENVER-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const exists = await prisma.productionFlow.findFirst({
      where: { number: n },
      select: { id: true },
    });
    if (!exists) return n;
  }
  return `ENVER-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export type AcceptOrchestrationInput = {
  dealId: string;
  actorUserId: string;
  estimateId?: string | null;
};

export async function acceptProductionOrchestration(
  prisma: PrismaClient,
  input: AcceptOrchestrationInput,
): Promise<
  | { ok: true; orchestrationId: string }
  | { ok: false; error: string; code: "STATE" | "CONFLICT" | "NOT_FOUND" }
> {
  const { dealId, actorUserId } = input;

  const existing = await prisma.productionFlow.findUnique({
    where: { dealId },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "Потік виробництва для цієї замовлення вже створено",
      code: "CONFLICT",
    };
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { handoff: true },
  });
  if (!deal?.handoff) {
    return { ok: false, error: "Немає пакета передачі (handoff)", code: "NOT_FOUND" };
  }

  if (
    deal.handoff.status !== HandoffStatus.SUBMITTED &&
    deal.handoff.status !== HandoffStatus.ACCEPTED
  ) {
    return {
      ok: false,
      error: "Пакет передачі має бути поданий (SUBMITTED) або прийнятий менеджером",
      code: "STATE",
    };
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || "CRM";

  const { flow } = await createProductionFlowFromDealHandoff({
    dealId,
    actorName,
    defaultChiefUserId: actorUserId,
  });

  await acceptFlowByChief(flow.id, {
    actorName,
    chiefUserId: actorUserId,
  });

  await appendActivityLog({
    entityType: "DEAL",
    entityId: dealId,
    type: "HANDOFF_ACCEPTED",
    actorUserId,
    data: {
      productionFlowId: flow.id,
      estimateId: input.estimateId ?? null,
    },
  });

  return { ok: true, orchestrationId: flow.id };
}

export async function requestHandoffClarification(
  prisma: PrismaClient,
  input: {
    dealId: string;
    actorUserId: string;
    issues: unknown[];
    messageToManager?: string | null;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const deal = await prisma.deal.findUnique({
    where: { id: input.dealId },
    select: { id: true },
  });
  if (!deal) return { ok: false, error: "Замовлення не знайдено" };

  const flow = await prisma.productionFlow.findUnique({
    where: { dealId: input.dealId },
    select: { id: true },
  });

  const text = [
    input.messageToManager?.trim(),
    input.issues?.length
      ? `Питання: ${JSON.stringify(input.issues).slice(0, 4000)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (flow) {
    const actor = await prisma.user.findUnique({
      where: { id: input.actorUserId },
      select: { name: true, email: true },
    });
    const actorName = actor?.name?.trim() || actor?.email || "CRM";
    const q = await addFlowQuestion(flow.id, {
      actorName,
      text: text || "Запит уточнення по handoff",
      source: "HANDOFF",
      isCritical: true,
    });
    await appendActivityLog({
      entityType: "DEAL",
      entityId: input.dealId,
      type: "DEAL_UPDATED",
      actorUserId: input.actorUserId,
      data: { clarificationQuestionId: q.id },
    });
    return { ok: true, id: q.id };
  }

  await appendActivityLog({
    entityType: "DEAL",
    entityId: input.dealId,
    type: "DEAL_UPDATED",
    actorUserId: input.actorUserId,
    data: { handoffClarification: text || "clarification" },
  });
  return { ok: true, id: `log-${input.dealId}` };
}

export async function rejectHandoffToManager(
  prisma: PrismaClient,
  input: {
    dealId: string;
    actorUserId: string;
    reason: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const handoff = await prisma.dealHandoff.findUnique({
    where: { dealId: input.dealId },
  });
  if (!handoff) return { ok: false, error: "Handoff не знайдено" };

  await prisma.dealHandoff.update({
    where: { dealId: input.dealId },
    data: {
      status: HandoffStatus.REJECTED,
      rejectionReason: input.reason,
      rejectedAt: new Date(),
    },
  });

  await appendActivityLog({
    entityType: "DEAL",
    entityId: input.dealId,
    type: "HANDOFF_REJECTED",
    actorUserId: input.actorUserId,
    data: { reason: input.reason },
  });

  return { ok: true };
}

export async function assignProductionConstructor(
  prisma: PrismaClient,
  input: {
    dealId: string;
    actorUserId: string;
    type: "INTERNAL" | "OUTSOURCED";
    constructorUserId?: string | null;
    constructorExternalName?: string | null;
    constructorExternalPhone?: string | null;
    constructorExternalEmail?: string | null;
    dueDate?: Date | null;
    productionNotes?: string | null;
    regenerateToken?: boolean;
  },
): Promise<
  | { ok: true; orchestrationId: string; externalWorkspaceToken: string | null }
  | { ok: false; error: string; code: "NOT_FOUND" | "STATE" | "VALIDATION" }
> {
  const flow = await prisma.productionFlow.findUnique({
    where: { dealId: input.dealId },
  });
  if (!flow) {
    return {
      ok: false,
      error: "Спочатку прийміть замовлення у виробничий потік",
      code: "NOT_FOUND",
    };
  }

  if (input.type === "INTERNAL") {
    if (!input.constructorUserId?.trim()) {
      return {
        ok: false,
        error: "Оберіть внутрішнього конструктора (користувача CRM)",
        code: "VALIDATION",
      };
    }
  } else if (!input.constructorExternalName?.trim()) {
    return {
      ok: false,
      error: "Вкажіть імʼя або компанію зовнішнього конструктора",
      code: "VALIDATION",
    };
  }

  const actor = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || "CRM";

  const constructorUser =
    input.type === "INTERNAL" && input.constructorUserId
      ? await prisma.user.findUnique({
          where: { id: input.constructorUserId },
          select: { name: true, email: true },
        })
      : null;

  const mode: "INTERNAL" | "OUTSOURCE" =
    input.type === "INTERNAL" ? "INTERNAL" : "OUTSOURCE";
  const constructorName =
    input.type === "INTERNAL"
      ? (constructorUser?.name?.trim() || constructorUser?.email || "Конструктор")
      : (input.constructorExternalName ?? "Зовнішній конструктор");

  const dueDate =
    input.dueDate ??
    flow.dueDate ??
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  if (input.productionNotes?.trim()) {
    await prisma.productionFlow.update({
      where: { id: flow.id },
      data: { productSummary: input.productionNotes.trim() },
    });
  }

  await assignConstructor(flow.id, {
    actorName,
    constructorMode: mode,
    constructorName,
    constructorCompany:
      input.type === "OUTSOURCED" ? input.constructorExternalName : null,
    constructorWorkspaceUrl: flow.constructorWorkspaceUrl ?? undefined,
    dueDate: dueDate.toISOString(),
  });

  const after = await prisma.productionFlow.findUnique({
    where: { id: flow.id },
    select: { constructorWorkspaceUrl: true },
  });

  await appendActivityLog({
    entityType: "DEAL",
    entityId: input.dealId,
    type: "DEAL_UPDATED",
    actorUserId: input.actorUserId,
    data: {
      productionFlowId: flow.id,
      constructorAssigned: true,
      mode: input.type,
    },
  });

  return {
    ok: true,
    orchestrationId: flow.id,
    externalWorkspaceToken: after?.constructorWorkspaceUrl ?? null,
  };
}
