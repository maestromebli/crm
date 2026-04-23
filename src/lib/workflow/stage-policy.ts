import {
  evaluateCloseOrderGate,
  evaluateReadyForHandoffGate,
  evaluateReleaseToProductionGate,
} from "@/lib/enver/order-execution-policy";

type StageGuardInput = {
  currentStageSlug: string;
  nextStageSlug: string;
  hasEstimate: boolean;
  hasQuote: boolean;
  contractSigned: boolean;
  payment70Done: boolean;
  productionStarted: boolean;
  hasExecutionSpec: boolean;
  hasRequiredHandoffFiles: boolean;
  handoffAccepted: boolean;
  handoffChecklistCompleted: boolean;
  bomApproved: boolean;
  criticalMaterialsReady: boolean;
  deliveryAccepted: boolean;
  financeActualsPosted: boolean;
  productionDone: boolean;
};

export type StageGuardResult = {
  ok: boolean;
  blockers: Array<{
    code: string;
    message: string;
  }>;
};

const CONTRACTISH = new Set(["contract", "payment", "handoff", "production", "won"]);

export function evaluateDealStageTransitionGuard(input: StageGuardInput): StageGuardResult {
  const blockers: StageGuardResult["blockers"] = [];
  const nextSlug = input.nextStageSlug.trim().toLowerCase();
  const enteringContractRail =
    CONTRACTISH.has(nextSlug) &&
    !CONTRACTISH.has(input.currentStageSlug.trim().toLowerCase());

  if (enteringContractRail && !input.hasEstimate) {
    blockers.push({
      code: "estimate_required",
      message: "Перед переходом потрібен прорахунок (estimate).",
    });
  }
  if (enteringContractRail && !input.hasQuote) {
    blockers.push({
      code: "quote_required",
      message: "Перед переходом потрібно відправити КП.",
    });
  }
  if (nextSlug === "handoff") {
    blockers.push(
      ...evaluateReadyForHandoffGate({
        contractSigned: input.contractSigned,
        hasExecutionSpec: input.hasExecutionSpec,
        hasRequiredHandoffFiles: input.hasRequiredHandoffFiles,
      }).map((item) => ({ code: item.code, message: item.message })),
    );
  }
  if (nextSlug === "production" && !input.payment70Done) {
    blockers.push({
      code: "prepayment_70_required",
      message: "Для запуску у виробництво потрібно >=70% оплати.",
    });
  }
  if (nextSlug === "production") {
    blockers.push(
      ...evaluateReleaseToProductionGate({
        handoffAccepted: input.handoffAccepted,
        handoffChecklistCompleted: input.handoffChecklistCompleted,
        bomApproved: input.bomApproved,
        criticalMaterialsReady: input.criticalMaterialsReady,
      }).map((item) => ({ code: item.code, message: item.message })),
    );
  }
  if (nextSlug === "won" && !input.productionStarted) {
    blockers.push({
      code: "production_started_required",
      message: "Для завершення замовлення потрібно зафіксувати запуск у виробництво.",
    });
  }
  if (nextSlug === "won" || nextSlug === "closed" || nextSlug === "completed") {
    blockers.push(
      ...evaluateCloseOrderGate({
        deliveryAccepted: input.deliveryAccepted,
        financeActualsPosted: input.financeActualsPosted,
        productionDone: input.productionDone,
      }).map((item) => ({ code: item.code, message: item.message })),
    );
  }

  return {
    ok: blockers.length === 0,
    blockers,
  };
}
