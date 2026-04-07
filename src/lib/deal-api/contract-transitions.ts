import type { DealContractStatus } from "@prisma/client";

/** Дозволені переходи статусу договору (MVP, розширювано). */
export const CONTRACT_STATUS_TRANSITIONS: Record<
  DealContractStatus,
  DealContractStatus[]
> = {
  DRAFT: ["GENERATED", "EDITED"],
  GENERATED: [
    "EDITED",
    "PENDING_INTERNAL_APPROVAL",
    "APPROVED_INTERNAL",
    "SENT_FOR_SIGNATURE",
  ],
  EDITED: [
    "PENDING_INTERNAL_APPROVAL",
    "APPROVED_INTERNAL",
    "SENT_FOR_SIGNATURE",
    "GENERATED",
  ],
  PENDING_INTERNAL_APPROVAL: ["APPROVED_INTERNAL", "EDITED", "DECLINED"],
  APPROVED_INTERNAL: ["SENT_FOR_SIGNATURE", "EDITED"],
  SENT_FOR_SIGNATURE: [
    "VIEWED_BY_CLIENT",
    "CLIENT_SIGNED",
    "DECLINED",
    "EXPIRED",
  ],
  VIEWED_BY_CLIENT: ["CLIENT_SIGNED", "DECLINED", "EXPIRED"],
  CLIENT_SIGNED: ["COMPANY_SIGNED", "FULLY_SIGNED"],
  COMPANY_SIGNED: ["FULLY_SIGNED"],
  FULLY_SIGNED: ["SUPERSEDED"],
  DECLINED: ["DRAFT"],
  EXPIRED: ["DRAFT"],
  SUPERSEDED: [],
};

export function canTransitionContractStatus(
  from: DealContractStatus,
  to: DealContractStatus,
): boolean {
  return CONTRACT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
