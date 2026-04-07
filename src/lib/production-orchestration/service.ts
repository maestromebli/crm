import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ActivityEntityType,
  ActivityType,
  ConstructorAssignmentType,
  HandoffStatus,
  ProductionOrchestrationStatus,
  ProductionSubflowState,
} from "@prisma/client";
import { appendActivityLog } from "@/lib/deal-api/audit";

export async function generateUniqueProductionNumber(
  prisma: PrismaClient,
): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const n = `ENVER-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const exists = await prisma.productionOrchestration.findUnique({
      where: { productionNumber: n },
      select: { id: true },
    });
    if (!exists) return n;
  }
  return `ENVER-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export type AcceptOrchestrationInput = {
  dealId: string;
  actorUserId: string;
  /** Актуальна смета угоди (остання затверджена / активна — визначає UI). */
  estimateId?: string | null;
};

export async function acceptProductionOrchestration(
  prisma: PrismaClient,
  input: AcceptOrchestrationInput,
): Promise<
  | { ok: true; orchestrationId: string }
  | { ok: false; error: string; code: "STATE" | "CONFLICT" | "NOT_FOUND" }
> {
  const { dealId, actorUserId, estimateId } = input;

  const existing = await prisma.productionOrchestration.findUnique({
    where: { dealId },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "Оркестрацію для цієї угоди вже створено", code: "CONFLICT" };
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

  const productionNumber = await generateUniqueProductionNumber(prisma);

  const orch = await prisma.productionOrchestration.create({
    data: {
      dealId,
      estimateId: estimateId ?? null,
      productionNumber,
      status: ProductionOrchestrationStatus.ACCEPTED,
      acceptedById: actorUserId,
      acceptedAt: new Date(),
    },
  });

  await appendActivityLog({
    entityType: ActivityEntityType.PRODUCTION_ORCHESTRATION,
    entityId: orch.id,
    type: ActivityType.PRODUCTION_ORCHESTRATION_ACCEPTED,
    actorUserId,
    data: {
      dealId,
      productionNumber: orch.productionNumber,
    },
  });

  await appendActivityLog({
    entityType: ActivityEntityType.DEAL,
    entityId: dealId,
    type: ActivityType.PRODUCTION_ORCHESTRATION_ACCEPTED,
    actorUserId,
    data: {
      productionOrchestrationId: orch.id,
      productionNumber: orch.productionNumber,
    },
  });

  return { ok: true, orchestrationId: orch.id };
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
  if (!deal) return { ok: false, error: "Угоду не знайдено" };

  const row = await prisma.productionHandoffClarification.create({
    data: {
      dealId: input.dealId,
      issuesJson: input.issues as Prisma.InputJsonValue,
      messageToManager: input.messageToManager ?? null,
      createdById: input.actorUserId,
    },
  });

  await appendActivityLog({
    entityType: ActivityEntityType.DEAL,
    entityId: input.dealId,
    type: ActivityType.PRODUCTION_ORCHESTRATION_CLARIFICATION_REQUESTED,
    actorUserId: input.actorUserId,
    data: { clarificationId: row.id },
  });

  return { ok: true, id: row.id };
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
    entityType: ActivityEntityType.DEAL,
    entityId: input.dealId,
    type: ActivityType.PRODUCTION_ORCHESTRATION_REJECTED,
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
    /** Для зовнішнього: згенерувати новий токен посилання. */
    regenerateToken?: boolean;
  },
): Promise<
  | { ok: true; orchestrationId: string; externalWorkspaceToken: string | null }
  | { ok: false; error: string; code: "NOT_FOUND" | "STATE" | "VALIDATION" }
> {
  const orch = await prisma.productionOrchestration.findUnique({
    where: { dealId: input.dealId },
  });
  if (!orch) {
    return {
      ok: false,
      error: "Спочатку прийміть угоду у виробничу оркестрацію",
      code: "NOT_FOUND",
    };
  }

  if (
    orch.status !== ProductionOrchestrationStatus.ACCEPTED &&
    orch.status !== ProductionOrchestrationStatus.CONSTRUCTOR_ASSIGNED
  ) {
    return {
      ok: false,
      error: "Призначення зараз недоступне для цього статусу оркестрації",
      code: "STATE",
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

  let externalWorkspaceToken: string | null = orch.externalWorkspaceToken;
  if (input.type === "OUTSOURCED") {
    if (input.regenerateToken || !externalWorkspaceToken) {
      externalWorkspaceToken = randomBytes(32).toString("hex");
    }
  } else {
    externalWorkspaceToken = null;
  }

  const updated = await prisma.productionOrchestration.update({
    where: { id: orch.id },
    data: {
      constructorType:
        input.type === "INTERNAL"
          ? ConstructorAssignmentType.INTERNAL
          : ConstructorAssignmentType.OUTSOURCED,
      constructorUserId: input.type === "INTERNAL" ? input.constructorUserId! : null,
      constructorExternalName:
        input.type === "OUTSOURCED" ? input.constructorExternalName ?? null : null,
      constructorExternalPhone:
        input.type === "OUTSOURCED" ? input.constructorExternalPhone ?? null : null,
      constructorExternalEmail:
        input.type === "OUTSOURCED" ? input.constructorExternalEmail ?? null : null,
      externalWorkspaceToken,
      dueDate: input.dueDate ?? undefined,
      productionNotes:
        input.productionNotes !== undefined ? input.productionNotes : undefined,
      status: ProductionOrchestrationStatus.CONSTRUCTOR_ASSIGNED,
      designStatus: ProductionSubflowState.ACTIVE,
    },
  });

  await appendActivityLog({
    entityType: ActivityEntityType.PRODUCTION_ORCHESTRATION,
    entityId: orch.id,
    type: ActivityType.PRODUCTION_CONSTRUCTOR_ASSIGNED,
    actorUserId: input.actorUserId,
    data: {
      constructorType: input.type,
      constructorUserId: input.constructorUserId ?? null,
      hasExternalToken: Boolean(externalWorkspaceToken),
    },
  });

  await appendActivityLog({
    entityType: ActivityEntityType.DEAL,
    entityId: input.dealId,
    type: ActivityType.PRODUCTION_CONSTRUCTOR_ASSIGNED,
    actorUserId: input.actorUserId,
    data: {
      productionOrchestrationId: orch.id,
      constructorType: input.type,
    },
  });

  return {
    ok: true,
    orchestrationId: updated.id,
    externalWorkspaceToken,
  };
}
