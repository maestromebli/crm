import { DEAL_HUB_STAGE_LABELS, DEAL_HUB_TARGET_MARGIN_PCT } from "../domain/deal.constants";
import { normalizeDealHubStage } from "../domain/deal.status";
import type { DealHubOverview, DealHubRole, DealHubRiskItem } from "../domain/deal.types";
import { evaluateDealStageGates } from "../domain/deal.validation";
import { getDealHubAggregate } from "./deal-hub.repository";
import { evaluateDealHealth } from "./deal-health.service";
import { buildDealNextActions } from "./deal-next-actions.service";
import { buildDealTimeline } from "./deal-timeline.service";
import { readDealNumberFromMeta } from "@/lib/deals/deal-number";

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getDealHubOverview(
  dealId: string,
  role: DealHubRole,
): Promise<DealHubOverview | null> {
  const aggregate = await getDealHubAggregate(dealId);
  if (!aggregate?.deal) return null;

  const deal = aggregate.deal;
  const stage = normalizeDealHubStage(deal.stage.slug);
  const стан = evaluateDealHealth(aggregate);
  const nextActions = buildDealNextActions(aggregate, { role });
  const timeline = buildDealTimeline(aggregate);

  const latestEstimate = deal.estimates[0] ?? null;
  const approvedEstimate = deal.estimates.find((item) => item.status === "APPROVED") ?? null;
  const finance = deal.financeSnapshots[0] ?? null;

  const approvedTotal =
    toNumber(approvedEstimate?.totalPrice) ??
    toNumber(deal.value) ??
    null;
  const paidAmount = deal.paymentMilestones
    .filter((m) => Boolean(m.confirmedAt))
    .reduce((sum, m) => sum + (toNumber(m.amount) ?? 0), 0);
  const expectedTotal = approvedTotal ?? toNumber(finance?.revenueUah) ?? null;
  const outstandingAmount =
    expectedTotal != null ? Math.max(0, expectedTotal - paidAmount) : null;

  const depositPlan = deal.paymentMilestones[0] ?? null;
  const finalPlan = deal.paymentMilestones[deal.paymentMilestones.length - 1] ?? null;

  const gateContext = {
    hasApprovedPricing: Boolean(approvedEstimate),
    hasProposalDocument: aggregate.latestAttachments.some((f) =>
      String(f.category).toUpperCase().includes("PROPOSAL"),
    ),
    hasContract: Boolean(deal.contract),
    contractAmountAligned: Boolean(deal.contract) && (approvedTotal ?? 0) > 0,
    hasDepositPlan: Boolean(depositPlan),
    isDepositReceived: Boolean(depositPlan?.confirmedAt),
    measurementComplete: Boolean(
      ((deal.workspaceMeta ?? {}) as Record<string, unknown>).measurementComplete,
    ),
    technicalFilesApproved: aggregate.latestAttachments.some((f) =>
      String(f.category).toUpperCase().includes("DRAW"),
    ),
    productionHandoffComplete: deal.handoff?.status === "ACCEPTED",
    criticalMaterialsConfirmed: Boolean(deal.handoff?.submittedAt),
    productionEnoughForInstall: Boolean(deal.productionFlow?.acceptedAt),
    deliveryDatePlanned: Boolean(deal.installationDate),
    siteReadinessConfirmed: Boolean(
      ((deal.workspaceMeta ?? {}) as Record<string, unknown>).installationDate,
    ),
    installationLoggedComplete: stage === "FINAL_PAYMENT" || stage === "CLOSED",
    defectsEvaluated: true,
  };

  const marginPct = toNumber(finance?.marginPct);
  const risks: DealHubRiskItem[] = стан.reasons.map((reason, idx) => ({
    id: `risk-${idx + 1}`,
    severity:
      стан.status === "CRITICAL"
        ? "critical"
        : стан.status === "RISK"
          ? "risk"
          : "warning",
    title: reason,
  }));

  return {
    deal: {
      id: deal.id,
      title: deal.title,
      code: readDealNumberFromMeta(deal.workspaceMeta) || deal.productionFlow?.number?.trim() || null,
      status: deal.status,
      stage,
      stageLabel: DEAL_HUB_STAGE_LABELS[stage],
      priority: "NORMAL",
      expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
      installationDate: deal.installationDate?.toISOString() ?? null,
      ownerName: deal.owner.name ?? deal.owner.email,
    },
    client: deal.client
      ? {
          id: deal.client.id,
          name: deal.client.name,
          primaryContactName: deal.primaryContact?.fullName ?? null,
        }
      : null,
    pricing: {
      approvedTotal,
      latestTotal: toNumber(latestEstimate?.totalPrice),
      marginPct,
      estimatesCount: deal.estimates.length,
      latestVersionLabel: latestEstimate ? `v${latestEstimate.version}` : null,
      lowMarginWarning: marginPct != null && marginPct < DEAL_HUB_TARGET_MARGIN_PCT,
    },
    finance: {
      paidAmount,
      outstandingAmount,
      depositRequired: toNumber(depositPlan?.amount),
      depositReceived: depositPlan?.confirmedAt ? toNumber(depositPlan.amount) : 0,
      finalPaymentRequired: toNumber(finalPlan?.amount),
      finalPaymentReceived: finalPlan?.confirmedAt ? toNumber(finalPlan.amount) : 0,
      paymentProgressPct:
        expectedTotal && expectedTotal > 0
          ? Math.min(100, Math.round((paidAmount / expectedTotal) * 100))
          : null,
    },
    production: {
      readiness:
        deal.handoff?.status === "ACCEPTED"
          ? "ready"
          : deal.handoff?.status === "REJECTED"
            ? "blocked"
            : "not_ready",
      hasProductionFlow: Boolean(deal.productionFlow),
      handoffStatus: deal.handoff?.status ?? null,
      blockersCount: risks.filter((risk) => risk.severity !== "warning").length,
    },
    installation: {
      plannedDate: deal.installationDate?.toISOString() ?? null,
      readiness: deal.installationDate ? "ready" : "not_ready",
    },
    files: {
      total: aggregate.latestAttachments.length,
      latest: aggregate.latestAttachments.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        category: file.category,
        createdAt: file.createdAt.toISOString(),
      })),
    },
    timelinePreview: timeline.slice(0, 8).map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      occurredAt: item.occurredAt,
      actorName: item.actorName,
    })),
    stageGates: evaluateDealStageGates(gateContext),
    nextActions,
    risks,
    стан,
  };
}
