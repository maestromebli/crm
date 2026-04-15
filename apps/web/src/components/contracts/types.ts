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

export interface ContractEntity {
  id: string;
  status: ContractStatus;
  contractNumber: string;
  contractDate: string;
  customerType?: string;
  objectAddress?: string;
  deliveryAddress?: string;
  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  productionLeadTimeDays?: number;
  installationLeadTime?: string;
  paymentTerms?: string;
  warrantyMonths?: number;
  managerComment?: string;
  specialConditions?: string;
  supplierSignerName?: string;
  supplierSignerBasis?: string;
  customer: {
    fullName: string;
    taxId?: string;
    passportData?: string;
    phone?: string;
    email?: string;
  };
  specification?: {
    items: Array<{
      id: string;
      lineNumber: number;
      productName: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      notes?: string;
    }>;
    subtotal: number;
    total: number;
    totalFormattedText?: string;
    currency: string;
  };
  documents?: Array<{
    id: string;
    type: string;
    fileName: string;
    pdfUrl?: string;
    storageKey: string;
    createdAt: string;
  }>;
  auditLogs?: Array<{
    id: string;
    action: string;
    actorRole?: string;
    createdAt: string;
  }>;
  shareLinks?: Array<{
    id: string;
    token: string;
    expiresAt: string;
    status: string;
    viewCount: number;
  }>;
}
