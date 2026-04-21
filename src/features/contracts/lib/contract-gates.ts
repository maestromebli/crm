import type { EnverContractStatus, EnverSignatureStatus } from "@prisma/client";

export type OrderContractGate =
  | "NO_CONTRACT"
  | "DRAFT_CONTRACT"
  | "CONTRACT_SENT"
  | "CONTRACT_SIGNED"
  | "CONTRACT_PROBLEM";

export function computeOrderContractGate(input: {
  contractRequired: boolean;
  contractStatus?: EnverContractStatus | null;
  signatureStatus?: EnverSignatureStatus | null;
}): OrderContractGate {
  if (!input.contractRequired) return "CONTRACT_SIGNED";
  if (!input.contractStatus) return "NO_CONTRACT";

  if (input.contractStatus === "SIGNED" || input.signatureStatus === "SIGNED") {
    return "CONTRACT_SIGNED";
  }

  if (
    ["DECLINED", "EXPIRED", "VOIDED"].includes(String(input.contractStatus)) ||
    ["FAILED", "CANCELLED", "EXPIRED"].includes(String(input.signatureStatus))
  ) {
    return "CONTRACT_PROBLEM";
  }

  if (["SENT_FOR_SIGNATURE", "PARTIALLY_SIGNED"].includes(String(input.contractStatus))) {
    return "CONTRACT_SENT";
  }

  return "DRAFT_CONTRACT";
}

export function isOrderActionBlockedByContractGate(
  gate: OrderContractGate,
  action:
    | "MOVE_TO_PRODUCTION_READY"
    | "RELEASE_EXPENSIVE_PROCUREMENT"
    | "INSTALLATION_CONFIRMATION"
    | "FINAL_MANUFACTURING_GATE",
): boolean {
  if (gate === "CONTRACT_SIGNED") return false;
  return [
    "MOVE_TO_PRODUCTION_READY",
    "RELEASE_EXPENSIVE_PROCUREMENT",
    "INSTALLATION_CONFIRMATION",
    "FINAL_MANUFACTURING_GATE",
  ].includes(action);
}
