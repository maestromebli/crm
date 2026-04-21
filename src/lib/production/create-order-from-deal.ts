import type { Prisma, PrismaClient } from "@prisma/client";
import {
  allReadinessMet,
  evaluateReadiness,
} from "@/lib/deal-core/readiness";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import { getEffectivePaymentMilestonesFromParts } from "@/lib/deal-core/payment-aggregate";
import { parseDealControlMeasurement } from "@/lib/deals/control-measurement";
import { createProductionFlowFromDealHandoff } from "@/features/production/server/services/production-flow.service";

function parseMeta(raw: Prisma.JsonValue | null): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
}

function paymentProgressFromPlan(stepsJson: Prisma.JsonValue | null): {
  ok: boolean;
} | null {
  if (!stepsJson || !Array.isArray(stepsJson)) return null;
  let totalPct = 0;
  let paidPct = 0;
  for (const raw of stepsJson) {
    const s = raw as {
      percent?: number;
      status?: string;
      paidAt?: string | null;
    };
    const p = s.percent ?? 0;
    totalPct += p;
    const paid =
      s.status === "PAID" ||
      s.status === "paid" ||
      Boolean(s.paidAt);
    if (paid) paidPct += p;
  }
  if (totalPct <= 0) return null;
  return { ok: paidPct / totalPct >= 0.69 };
}

function hasSeventyPercentPaid(
  meta: DealWorkspaceMeta,
  paymentPlan: { stepsJson: Prisma.JsonValue } | null,
): boolean {
  const fromPlan = paymentProgressFromPlan(paymentPlan?.stepsJson ?? null);
  if (fromPlan) return fromPlan.ok;

  const rows = getEffectivePaymentMilestonesFromParts(meta, []);
  if (rows.length > 0) {
    let total = 0;
    let paid = 0;
    for (const m of rows) {
      const a = m.amount ?? 0;
      if (a > 0) total += a;
      if (m.done && a > 0) paid += a;
    }
    if (total > 0) return paid / total >= 0.69;
    const doneCount = rows.filter((m) => m.done).length;
    return doneCount >= 1;
  }
  const fallback = meta.payment?.milestones ?? [];
  if (fallback.length === 0) return false;
  let total = 0;
  let paid = 0;
  for (const m of fallback) {
    const a = m.amount ?? 0;
    if (a > 0) total += a;
    if (m.done && a > 0) paid += a;
  }
  if (total > 0) return paid / total >= 0.69;
  return fallback.some((m) => m.done);
}

export type CreateProductionOrderResult =
  | { ok: true; orderId: string }
  | {
      ok: false;
      code: "ALREADY_EXISTS" | "VALIDATION";
      message: string;
      checks?: ReturnType<typeof evaluateReadiness>;
    };

export async function createProductionOrderFromDeal(
  prisma: PrismaClient,
  dealId: string,
  _opts: {
    priority?: string;
    includePainting?: boolean;
    deadline?: Date | null;
  } = {},
): Promise<CreateProductionOrderResult> {
  const existing = await prisma.productionFlow.findUnique({
    where: { dealId },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      code: "ALREADY_EXISTS",
      message: "Виробничий потік для цієї замовлення вже створено.",
    };
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      contract: { select: { status: true } },
    },
  });
  if (!deal) {
    return { ok: false, code: "VALIDATION", message: "Замовлення не знайдено." };
  }

  const plan = await prisma.dealPaymentPlan.findUnique({
    where: { dealId },
    select: { stepsJson: true },
  });

  const attachments = await prisma.attachment.findMany({
    where: { entityType: "DEAL", entityId: dealId, deletedAt: null },
    select: { category: true },
  });
  const attachmentsByCategory: Record<string, number> = {};
  for (const a of attachments) {
    const k = a.category;
    attachmentsByCategory[k] = (attachmentsByCategory[k] ?? 0) + 1;
  }

  const meta = parseMeta(deal.workspaceMeta);
  const ext = meta as unknown as {
    controlMeasurement?: ReturnType<typeof parseDealControlMeasurement>;
  };
  const controlMeasurement =
    ext.controlMeasurement ??
    parseDealControlMeasurement(null);

  const checks = evaluateReadiness({
    meta,
    contractStatus: deal.contract?.status ?? null,
    attachmentsByCategory,
    controlMeasurement,
  });

  const prepayOk = hasSeventyPercentPaid(meta, plan);
  if (!prepayOk) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Потрібна передоплата відповідно до політики (≈70%).",
      checks,
    };
  }

  if (!allReadinessMet(checks)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Чеклист готовності не виконано повністю.",
      checks,
    };
  }

  const { flow } = await createProductionFlowFromDealHandoff({
    dealId,
    actorName: "createProductionOrderFromDeal",
  });

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      workspaceMeta: {
        ...meta,
        productionOrderCreated: true,
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_UPDATED",
      source: "SYSTEM",
      data: { productionFlowId: flow.id },
    },
  });

  await prisma.domainEvent.create({
    data: {
      type: "PRODUCTION_FLOW_CREATED",
      dealId,
      payload: { productionFlowId: flow.id },
    },
  });

  return { ok: true, orderId: flow.id };
}
