export type ContractStatus =
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

export type ContractSpecItem = {
  lineNumber: number;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
};

export type ContractViewModel = {
  id: string;
  dealId: string;
  status: ContractStatus;
  rawStatus: string;
  templateKey: string | null;
  version: number;
  fields: Record<string, unknown>;
  preview: {
    contractNumber: string;
    contractDate: string;
    customerFullName: string;
    totalAmount: number;
    totalAmountFormatted: string;
    advanceAmount: number;
    remainingAmount: number;
  };
  specification: {
    items: ContractSpecItem[];
    subtotal: number;
    total: number;
    formattedTotalText: string;
    currency: string;
  };
  documents?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    type: string;
    createdAt: string;
  }>;
  audit?: Array<{
    id: string;
    action: string;
    actorUserId: string | null;
    source: string;
    payload: unknown;
    createdAt: string;
  }>;
};
