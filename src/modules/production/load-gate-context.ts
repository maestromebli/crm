import type { Prisma, PrismaClient } from "@prisma/client";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import { getEffectivePaymentMilestonesFromParts } from "@/lib/deal-core/payment-aggregate";
import type { DealControlMeasurementV1 } from "../../lib/deals/control-measurement";
import { parseHandoffManifest } from "../../lib/deals/document-templates";
import {
  evaluateProductionReadinessGate,
  type ProductionReadinessGateInput,
} from "./production-readiness-gate";
import { getProcurementSummaryForDeal } from "./procurement-for-deal";

function parseMeta(raw: unknown): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
}

function parseControlMeasurement(
  raw: unknown,
): DealControlMeasurementV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as DealControlMeasurementV1;
}

function milestonesFromPaymentPlan(plan: {
  stepsJson: Prisma.JsonValue;
} | null): Array<{
  id: string;
  sortOrder: number;
  label: string | null;
  amount: number;
  currency: string | null;
  dueAt: string | null;
  confirmedAt: string | null;
}> {
  if (!plan?.stepsJson || !Array.isArray(plan.stepsJson)) return [];
  return plan.stepsJson.map((raw, i) => {
    const s = raw as {
      percent?: number;
      amount?: number | null;
      dueDate?: string | null;
      status?: string;
      label?: string | null;
      paidAt?: string | null;
    };
    const amountNum =
      typeof s.amount === "number" && !Number.isNaN(s.amount) ? s.amount : 0;
    const paid =
      s.status === "PAID" ||
      s.status === "paid" ||
      Boolean(s.paidAt);
    let confirmedAt: string | null = null;
    if (paid && s.paidAt) {
      confirmedAt = new Date(s.paidAt).toISOString();
    } else if (paid) {
      confirmedAt = new Date().toISOString();
    }
    return {
      id: `pp-${i}`,
      sortOrder: i,
      label: s.label ?? (i === 0 ? "Аванс 70%" : "Фінал 30%"),
      amount: amountNum,
      currency: "UAH",
      dueAt: s.dueDate ? new Date(s.dueDate).toISOString() : null,
      confirmedAt,
    };
  });
}

export async function loadProductionReadinessGateForDeal(
  prisma: PrismaClient,
  dealId: string,
): Promise<ReturnType<typeof evaluateProductionReadinessGate>> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      workspaceMeta: true,
      controlMeasurementJson: true,
      commercialSnapshotFrozenAt: true,
      contract: { select: { status: true } },
      handoff: { select: { status: true, manifestJson: true } },
      paymentPlan: { select: { stepsJson: true } },
    },
  });
  if (!deal) {
    throw new Error("Deal not found");
  }

  const attachments = await prisma.attachment.findMany({
    where: { entityType: "DEAL", entityId: dealId },
    select: { category: true },
  });
  const attachmentsByCategory: Record<string, number> = {};
  for (const a of attachments) {
    attachmentsByCategory[a.category] =
      (attachmentsByCategory[a.category] ?? 0) + 1;
  }

  const meta = parseMeta(deal.workspaceMeta);
  const manifest = parseHandoffManifest(deal.handoff?.manifestJson);
  const handoffHasSelectedFiles =
    manifest.selectedAttachmentIds.length > 0 ||
    manifest.selectedFileAssetIds.length > 0;

  const planRows = milestonesFromPaymentPlan(deal.paymentPlan);
  const effectivePaymentMilestones = getEffectivePaymentMilestonesFromParts(
    meta,
    planRows,
  );

  const procurement = await getProcurementSummaryForDeal(prisma, dealId);

  const input: ProductionReadinessGateInput = {
    meta,
    contractStatus: deal.contract?.status ?? null,
    attachmentsByCategory,
    effectivePaymentMilestones,
    controlMeasurement: parseControlMeasurement(deal.controlMeasurementJson),
    handoffStatus: deal.handoff?.status ?? null,
    handoffHasSelectedFiles,
    hasCommercialSnapshot: deal.commercialSnapshotFrozenAt != null,
    procurement,
  };

  return evaluateProductionReadinessGate(input);
}
