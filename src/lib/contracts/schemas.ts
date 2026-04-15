import { z } from "zod";

export const contractEditableFieldsSchema = z.object({
  contractNumber: z.string().min(1),
  contractDate: z.string().min(1),
  customerType: z.string().default("PERSON"),
  customerFullName: z.string().min(1),
  customerTaxId: z.string().optional().nullable(),
  customerPassportData: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  objectAddress: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  totalAmount: z.number(),
  advanceAmount: z.number(),
  remainingAmount: z.number(),
  productionLeadTimeDays: z.number().int().optional().nullable(),
  installationLeadTime: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  warrantyMonths: z.number().int().optional().nullable(),
  managerComment: z.string().optional().nullable(),
  specialConditions: z.string().optional().nullable(),
  supplierSignerName: z.string().optional().nullable(),
  supplierSignerBasis: z.string().optional().nullable(),
});

export const createFromQuotationSchema = z.object({
  dealId: z.string().min(1),
  quotationId: z.string().min(1),
  fields: contractEditableFieldsSchema.partial().optional(),
});

export const patchContractSchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "FILLED",
      "UNDER_REVIEW",
      "APPROVED",
      "SENT_TO_CUSTOMER",
      "VIEWED_BY_CUSTOMER",
      "CUSTOMER_SIGNING",
      "CUSTOMER_SIGNED",
      "FULLY_SIGNED",
      "REJECTED",
      "NEEDS_REVISION",
      "ARCHIVED",
    ])
    .optional(),
  fields: contractEditableFieldsSchema.partial().optional(),
});

export const shareContractSchema = z.object({
  expiresInHours: z.number().int().positive().max(24 * 30).default(72),
  maxViews: z.number().int().positive().max(500).optional(),
});
