import type { DealContractStatus } from "@prisma/client";

export type ContractApiStatus =
  | "DRAFT"
  | "FILLED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "SENT_TO_CUSTOMER"
  | "VIEWED_BY_CUSTOMER"
  | "CUSTOMER_SIGNING"
  | "CUSTOMER_SIGNED"
  | "FULLY_SIGNED"
  | "REJECTED"
  | "NEEDS_REVISION"
  | "ARCHIVED";

export function dealContractToApiStatus(status: DealContractStatus): ContractApiStatus {
  switch (status) {
    case "DRAFT":
      return "DRAFT";
    case "GENERATED":
    case "EDITED":
      return "FILLED";
    case "PENDING_INTERNAL_APPROVAL":
      return "UNDER_REVIEW";
    case "APPROVED_INTERNAL":
      return "APPROVED";
    case "SENT_FOR_SIGNATURE":
      return "SENT_TO_CUSTOMER";
    case "VIEWED_BY_CLIENT":
      return "VIEWED_BY_CUSTOMER";
    case "CLIENT_SIGNED":
      return "CUSTOMER_SIGNED";
    case "COMPANY_SIGNED":
    case "FULLY_SIGNED":
      return "FULLY_SIGNED";
    case "DECLINED":
      return "REJECTED";
    case "EXPIRED":
      return "NEEDS_REVISION";
    case "SUPERSEDED":
      return "ARCHIVED";
    default:
      return "DRAFT";
  }
}

export function apiToDealContractStatus(status: ContractApiStatus): DealContractStatus {
  switch (status) {
    case "DRAFT":
      return "DRAFT";
    case "FILLED":
      return "EDITED";
    case "UNDER_REVIEW":
      return "PENDING_INTERNAL_APPROVAL";
    case "APPROVED":
      return "APPROVED_INTERNAL";
    case "SENT_TO_CUSTOMER":
    case "CUSTOMER_SIGNING":
      return "SENT_FOR_SIGNATURE";
    case "VIEWED_BY_CUSTOMER":
      return "VIEWED_BY_CLIENT";
    case "CUSTOMER_SIGNED":
      return "CLIENT_SIGNED";
    case "FULLY_SIGNED":
      return "FULLY_SIGNED";
    case "REJECTED":
      return "DECLINED";
    case "NEEDS_REVISION":
      return "EDITED";
    case "ARCHIVED":
      return "SUPERSEDED";
    default:
      return "DRAFT";
  }
}
