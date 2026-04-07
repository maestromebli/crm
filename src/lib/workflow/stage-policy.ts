type StageGuardInput = {
  currentStageSlug: string;
  nextStageSlug: string;
  hasEstimate: boolean;
  hasQuote: boolean;
  contractSigned: boolean;
  payment70Done: boolean;
  productionStarted: boolean;
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
  const enteringContractRail =
    CONTRACTISH.has(input.nextStageSlug) && !CONTRACTISH.has(input.currentStageSlug);

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
  if (input.nextStageSlug === "handoff" && !input.contractSigned) {
    blockers.push({
      code: "contract_signed_required",
      message: "Перед передачею у виробництво договір має бути підписаний.",
    });
  }
  if (input.nextStageSlug === "production" && !input.payment70Done) {
    blockers.push({
      code: "prepayment_70_required",
      message: "Для запуску у виробництво потрібно >=70% оплати.",
    });
  }
  if (input.nextStageSlug === "won" && !input.productionStarted) {
    blockers.push({
      code: "production_started_required",
      message: "Для завершення угоди потрібно зафіксувати запуск у виробництво.",
    });
  }

  return {
    ok: blockers.length === 0,
    blockers,
  };
}
