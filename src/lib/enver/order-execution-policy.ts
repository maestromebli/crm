type EnverOrderGateCode =
  | "contract_signed_required"
  | "execution_spec_required"
  | "handoff_files_required"
  | "handoff_accepted_required"
  | "handoff_checklist_required"
  | "bom_approved_required"
  | "critical_materials_required"
  | "delivery_acceptance_required"
  | "finance_actuals_required"
  | "production_done_required";

export type EnverOrderGateBlocker = {
  code: EnverOrderGateCode;
  message: string;
};

export type EnverOrderGateInput = {
  contractSigned: boolean;
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

export function evaluateReadyForHandoffGate(
  input: Pick<
    EnverOrderGateInput,
    "contractSigned" | "hasExecutionSpec" | "hasRequiredHandoffFiles"
  >,
): EnverOrderGateBlocker[] {
  const blockers: EnverOrderGateBlocker[] = [];
  if (!input.contractSigned) {
    blockers.push({
      code: "contract_signed_required",
      message:
        "Не можна перевести у ready_for_handoff без підписаного/погодженого контрактного контуру.",
    });
  }
  if (!input.hasExecutionSpec) {
    blockers.push({
      code: "execution_spec_required",
      message:
        "Не можна перевести у ready_for_handoff без затвердженої execution-версії project spec.",
    });
  }
  if (!input.hasRequiredHandoffFiles) {
    blockers.push({
      code: "handoff_files_required",
      message:
        "Не можна перевести у ready_for_handoff без обов'язкового пакета технічних файлів.",
    });
  }
  return blockers;
}

export function evaluateReleaseToProductionGate(
  input: Pick<
    EnverOrderGateInput,
    | "handoffAccepted"
    | "handoffChecklistCompleted"
    | "bomApproved"
    | "criticalMaterialsReady"
  >,
): EnverOrderGateBlocker[] {
  const blockers: EnverOrderGateBlocker[] = [];
  if (!input.handoffAccepted) {
    blockers.push({
      code: "handoff_accepted_required",
      message: "Неможливо випустити у виробництво: handoff не прийнятий.",
    });
  }
  if (!input.handoffChecklistCompleted) {
    blockers.push({
      code: "handoff_checklist_required",
      message: "Неможливо випустити у виробництво: checklist передачі не complete.",
    });
  }
  if (!input.bomApproved) {
    blockers.push({
      code: "bom_approved_required",
      message: "Неможливо випустити у виробництво: BOM не затверджений.",
    });
  }
  if (!input.criticalMaterialsReady) {
    blockers.push({
      code: "critical_materials_required",
      message:
        "Неможливо випустити у виробництво: критичні матеріали не замовлені/не зарезервовані.",
    });
  }
  return blockers;
}

export function evaluateCloseOrderGate(
  input: Pick<
    EnverOrderGateInput,
    "deliveryAccepted" | "financeActualsPosted" | "productionDone"
  >,
): EnverOrderGateBlocker[] {
  const blockers: EnverOrderGateBlocker[] = [];
  if (!input.deliveryAccepted) {
    blockers.push({
      code: "delivery_acceptance_required",
      message: "Закриття замовлення заборонено: монтаж/здача не підтверджені.",
    });
  }
  if (!input.financeActualsPosted) {
    blockers.push({
      code: "finance_actuals_required",
      message: "Закриття замовлення заборонено: фінансові факти не проведені.",
    });
  }
  if (!input.productionDone) {
    blockers.push({
      code: "production_done_required",
      message: "Закриття замовлення заборонено: production order не завершений.",
    });
  }
  return blockers;
}

function readNestedBool(
  source: Record<string, unknown>,
  path: string[],
): boolean | undefined {
  let cursor: unknown = source;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "boolean" ? cursor : undefined;
}

export function extractEnverExecutionSignals(meta: Record<string, unknown>): {
  hasExecutionSpec: boolean;
  hasRequiredHandoffFiles: boolean;
  handoffChecklistCompleted: boolean;
  bomApproved: boolean;
  criticalMaterialsReady: boolean;
  deliveryAccepted: boolean;
  financeActualsPosted: boolean;
  productionDone: boolean;
} {
  const technicalReady =
    readNestedBool(meta, ["technicalChecklist", "finalDimensionsConfirmed"]) ===
      true &&
    readNestedBool(meta, ["technicalChecklist", "materialsConfirmed"]) ===
      true &&
    readNestedBool(meta, ["technicalChecklist", "fittingsConfirmed"]) ===
      true &&
    readNestedBool(meta, ["technicalChecklist", "drawingsAttached"]) === true;

  return {
    hasExecutionSpec:
      readNestedBool(meta, [
        "projectSpec",
        "currentVersionApprovedForExecution",
      ]) === true || technicalReady,
    hasRequiredHandoffFiles:
      readNestedBool(meta, ["handoffPackageReady"]) === true ||
      readNestedBool(meta, ["projectSpec", "requiredFilesComplete"]) === true,
    handoffChecklistCompleted:
      readNestedBool(meta, ["handoffGate", "checklistCompleted"]) === true,
    bomApproved: readNestedBool(meta, ["executionControl", "bomApproved"]) === true,
    criticalMaterialsReady:
      readNestedBool(meta, ["executionControl", "criticalMaterialsReady"]) === true,
    deliveryAccepted:
      readNestedBool(meta, ["executionControl", "deliveryAccepted"]) === true,
    financeActualsPosted:
      readNestedBool(meta, ["executionControl", "financeActualsPosted"]) === true,
    productionDone:
      readNestedBool(meta, ["executionControl", "productionOrderDone"]) === true,
  };
}
