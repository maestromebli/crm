import type { EnverContractStatus, EnverSignatureStatus } from "@prisma/client";

export const CONTRACT_FINAL_STATUSES: EnverContractStatus[] = [
  "SIGNED",
  "DECLINED",
  "EXPIRED",
  "VOIDED",
];

export function canIssue(status: EnverContractStatus): boolean {
  return ["DRAFT", "READY_FOR_REVIEW", "APPROVED_INTERNAL"].includes(status);
}

export function canSendForSignature(status: EnverContractStatus): boolean {
  return status === "ISSUED";
}

export function isSignatureTerminal(status: EnverSignatureStatus): boolean {
  return ["SIGNED", "FAILED", "CANCELLED", "EXPIRED"].includes(status);
}
