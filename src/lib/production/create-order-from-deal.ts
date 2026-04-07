import type {
  Prisma,
  PrismaClient,
  ProductionOrderPriority,
} from "@prisma/client";
import {
  allReadinessMet,
  evaluateReadiness,
} from "@/lib/deal-core/readiness";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import { getEffectivePaymentMilestonesFromParts } from "@/lib/deal-core/payment-aggregate";
import { parseDealControlMeasurement } from "@/lib/deals/control-measurement";
import { defaultStageSequence } from "./default-stages";
import { stageLabelUa } from "./default-stages";

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
  opts: {
    priority?: ProductionOrderPriority;
    includePainting?: boolean;
    deadline?: Date | null;
  } = {},
): Promise<CreateProductionOrderResult> {
  const existing = await prisma.productionOrder.findUnique({
    where: { dealId },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, code: "ALREADY_EXISTS", message: "Виробниче замовлення вже створено." };
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      contract: { select: { status: true } },
      paymentPlan: { select: { stepsJson: true } },
    },
  });
  if (!deal) {
    return { ok: false, code: "VALIDATION", message: "Угоду не знайдено." };
  }

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
  const controlMeasurement = parseDealControlMeasurement(deal.controlMeasurementJson);

  const checks = evaluateReadiness({
    meta,
    contractStatus: deal.contract?.status ?? null,
    attachmentsByCategory,
    controlMeasurement,
  });

  const prepayOk = hasSeventyPercentPaid(meta, deal.paymentPlan);
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

  const includePainting = opts.includePainting ?? true;
  const sequence = defaultStageSequence(includePainting);
  const deadline =
    opts.deadline ??
    deal.installationDate ??
    deal.expectedCloseDate ??
    null;

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.productionOrder.create({
      data: {
        dealId,
        status: "QUEUED",
        priority: opts.priority ?? "MEDIUM",
        startDate: new Date(),
        deadline,
        includePainting,
      },
    });

    for (let i = 0; i < sequence.length; i++) {
      const name = sequence[i]!;
      const stage = await tx.productionStage.create({
        data: {
          orderId: o.id,
          name,
          sortOrder: i,
          status: "PENDING",
        },
      });
      await tx.productionTask.create({
        data: {
          orderId: o.id,
          stageId: stage.id,
          title: `${stageLabelUa(name)} — основні роботи`,
          description: `Автозадача для етапу «${stageLabelUa(name)}».`,
          status: "TODO",
        },
      });
    }

    await tx.activityLog.create({
      data: {
        entityType: "DEAL",
        entityId: dealId,
        type: "PRODUCTION_ORDER_CREATED",
        source: "SYSTEM",
        data: { productionOrderId: o.id },
      },
    });

    await tx.domainEvent.create({
      data: {
        type: "PRODUCTION_ORDER_CREATED",
        dealId,
        payload: { productionOrderId: o.id },
      },
    });

    return o;
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

  return { ok: true, orderId: order.id };
}
