import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDealStageGates } from "./deal.validation";

test("stage gates include KP_APPROVED requirements", () => {
  const result = evaluateDealStageGates({
    hasApprovedPricing: false,
    hasProposalDocument: false,
    hasContract: false,
    contractAmountAligned: false,
    hasDepositPlan: false,
    isDepositReceived: false,
    measurementComplete: false,
    technicalFilesApproved: false,
    productionHandoffComplete: false,
    criticalMaterialsConfirmed: false,
    productionEnoughForInstall: false,
    deliveryDatePlanned: false,
    siteReadinessConfirmed: false,
    installationLoggedComplete: false,
    defectsEvaluated: false,
  });

  const kpGate = result.find((item) => item.stage === "KP_APPROVED");
  assert.ok(kpGate);
  assert.equal(kpGate.passed, false);
  assert.ok(kpGate.missing.includes("hasApprovedPricing"));
  assert.ok(kpGate.missing.includes("hasProposalDocument"));
});
