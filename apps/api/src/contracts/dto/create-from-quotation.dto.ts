export type ContractCustomerType = "PERSON" | "FOP" | "COMPANY";

export interface CreateContractFromQuotationDto {
  dealId: string;
  quotationId: string;
  customer: {
    fullName: string;
    taxId?: string;
    passportData?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  fields?: Partial<ContractEditableFieldsDto>;
}

export interface ContractEditableFieldsDto {
  contractNumber: string;
  contractDate: string;
  customerType: ContractCustomerType;
  customerFullName: string;
  customerTaxId?: string;
  customerPassportData?: string;
  customerPhone?: string;
  customerEmail?: string;
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
}
