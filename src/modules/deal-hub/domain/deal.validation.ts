import type { DealHubStage } from "./deal.status";
import type { DealHubStageGateResult } from "./deal.types";

export type DealStageGateContext = {
  hasApprovedPricing: boolean;
  hasProposalDocument: boolean;
  hasContract: boolean;
  contractAmountAligned: boolean;
  hasDepositPlan: boolean;
  isDepositReceived: boolean;
  measurementComplete: boolean;
  technicalFilesApproved: boolean;
  productionHandoffComplete: boolean;
  criticalMaterialsConfirmed: boolean;
  productionEnoughForInstall: boolean;
  deliveryDatePlanned: boolean;
  siteReadinessConfirmed: boolean;
  installationLoggedComplete: boolean;
  defectsEvaluated: boolean;
};

const STAGE_REQUIREMENTS: Record<DealHubStage, Array<keyof DealStageGateContext>> = {
  NEW: [],
  PRICING: [],
  KP_PREPARED: [],
  KP_APPROVED: ["hasApprovedPricing", "hasProposalDocument"],
  CONTRACT: ["hasContract", "contractAmountAligned"],
  PREPAYMENT: ["hasDepositPlan", "isDepositReceived"],
  MEASUREMENT: [],
  TECHNICAL_DESIGN: [],
  PRODUCTION_READY: [
    "measurementComplete",
    "technicalFilesApproved",
    "productionHandoffComplete",
    "criticalMaterialsConfirmed",
  ],
  PRODUCTION: [],
  PROCUREMENT: [],
  DELIVERY_READY: [],
  INSTALLATION: [
    "productionEnoughForInstall",
    "deliveryDatePlanned",
    "siteReadinessConfirmed",
  ],
  FINAL_PAYMENT: ["installationLoggedComplete", "defectsEvaluated"],
  CLOSED: [],
};

export function evaluateDealStageGates(
  context: DealStageGateContext,
): DealHubStageGateResult[] {
  return (Object.keys(STAGE_REQUIREMENTS) as DealHubStage[]).map((stage) => {
    const required = STAGE_REQUIREMENTS[stage];
    const missing = required.filter((key) => !context[key]).map((key) => String(key));
    return { stage, passed: missing.length === 0, missing };
  });
}
