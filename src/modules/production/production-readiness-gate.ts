import type { DealContractStatus, HandoffStatus } from "@prisma/client";
import type { DealControlMeasurementV1 } from "../../lib/deals/control-measurement";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import type { EffectivePaymentMilestone } from "@/lib/deal-core/payment-aggregate";
import {
  allReadinessMet,
  evaluateReadiness,
} from "@/lib/deal-core/readiness";
import type { ProcurementGateSummary } from "./procurement-for-deal";

export type ProductionBlockerSeverity = "hard" | "soft";

export type ProductionReadinessBlocker = {
  id: string;
  severity: ProductionBlockerSeverity;
  messageUk: string;
  section: "contract" | "payment" | "technical" | "files" | "handoff" | "procurement" | "snapshot";
};

export type ProductionReadinessGateResult = {
  ready: boolean;
  /** Критичні перешкоди до запуску лінії / переходу «в роботу» */
  blockers: ProductionReadinessBlocker[];
  warnings: ProductionReadinessBlocker[];
  missingItems: string[];
  recommendedNextActionUk: string;
  /** Детальні перевірки (існуюча модель deal workspace) */
  checks: ReturnType<typeof evaluateReadiness>;
};

export type ProductionReadinessGateInput = {
  meta: DealWorkspaceMeta;
  contractStatus: DealContractStatus | null;
  attachmentsByCategory: Record<string, number>;
  effectivePaymentMilestones?: EffectivePaymentMilestone[];
  controlMeasurement?: DealControlMeasurementV1 | null;
  handoffStatus: HandoffStatus | null;
  /** Чи є вибрані файли в маніфесті передачі */
  handoffHasSelectedFiles: boolean;
  /** Погоджений комерційний знімок (узгоджене КП) */
  hasCommercialSnapshot: boolean;
  procurement: ProcurementGateSummary;
};

function firstBlockingMessage(
  blockers: ProductionReadinessBlocker[],
): string {
  const h = blockers.find((b) => b.severity === "hard");
  if (h) return h.messageUk;
  const s = blockers[0];
  return s ? s.messageUk : "Уточніть дані та повторіть перевірку.";
}

/**
 * Машиночитаний гейт готовності до виробництва (для воркспейсу замовлення, `/production`, AI).
 * Базується на `evaluateReadiness` + додаткові правила ENVER.
 */
export function evaluateProductionReadinessGate(
  input: ProductionReadinessGateInput,
): ProductionReadinessGateResult {
  const checks = evaluateReadiness({
    meta: input.meta,
    contractStatus: input.contractStatus,
    attachmentsByCategory: input.attachmentsByCategory,
    effectivePaymentMilestones: input.effectivePaymentMilestones,
    controlMeasurement: input.controlMeasurement,
  });

  const blockers: ProductionReadinessBlocker[] = [];
  const warnings: ProductionReadinessBlocker[] = [];
  const missingItems: string[] = [];

  for (const c of checks) {
    if (!c.done && c.blockerMessage) {
      missingItems.push(c.label);
      blockers.push({
        id: c.id,
        severity: "hard",
        messageUk: c.blockerMessage,
        section:
          c.id === "contract_signed"
            ? "contract"
            : c.id === "prepayment"
              ? "payment"
              : c.id === "technical_files"
                ? "files"
                : c.id === "handoff_package"
                  ? "handoff"
                  : "technical",
      });
    }
  }

  if (!input.hasCommercialSnapshot) {
    blockers.push({
      id: "commercial_snapshot",
      severity: "hard",
      messageUk:
        "Відсутній погоджений комерційний знімок (узгоджене КП у картці замовлення).",
      section: "snapshot",
    });
    missingItems.push("Погоджений комерційний знімок");
  }

  if (input.handoffStatus !== "ACCEPTED") {
    blockers.push({
      id: "handoff_accepted",
      severity: "hard",
      messageUk: "Передача в виробництво має бути прийнята (статус ACCEPTED).",
      section: "handoff",
    });
    missingItems.push("Прийнята передача");
  }

  if (!input.handoffHasSelectedFiles) {
    blockers.push({
      id: "handoff_files",
      severity: "hard",
      messageUk:
        "У пакеті передачі немає вибраних файлів (креслення / специфікація).",
      section: "handoff",
    });
    missingItems.push("Файли в маніфесті передачі");
  }

  if (input.procurement.projectCount > 0) {
    if (input.procurement.openRequests > 0) {
      warnings.push({
        id: "procurement_requests_open",
        severity: "soft",
        messageUk: `Є незакриті заявки закупівель (${input.procurement.openRequests}). Перевірте готовність постачання.`,
        section: "procurement",
      });
    }
    if (input.procurement.openMaterialLines > 0) {
      warnings.push({
        id: "procurement_lines_open",
        severity: "soft",
        messageUk: `Є відкриті позиції постачання (${input.procurement.openMaterialLines}).`,
        section: "procurement",
      });
    }
  }

  const ready =
    allReadinessMet(checks) &&
    input.hasCommercialSnapshot &&
    input.handoffStatus === "ACCEPTED" &&
    input.handoffHasSelectedFiles;

  const recommendedNextActionUk = ready
    ? "Можна ставити в чергу виробництва або виконувати наступний макро-етап."
    : firstBlockingMessage(blockers);

  return {
    ready,
    blockers,
    warnings,
    missingItems,
    recommendedNextActionUk,
    checks,
  };
}
