/**
 * Domain model for the commercial estimate workspace.
 * Maps to Prisma `Estimate` + `EstimateSection` + `EstimateLineItem` (+ metadataJson / settingsJson).
 */

export type EstimateVersionStatus = "draft" | "active" | "archived";

export type EstimateSectionType =
  | "room"
  | "service"
  | "delivery"
  | "installation"
  | "other";

export type EstimateItemType =
  | "product"
  | "material"
  | "hardware"
  | "service"
  | "custom";

export type DiscountType = "fixed" | "percent";

export type PricingMode =
  | "manual"
  | "quantity"
  | "area"
  | "length"
  | "module"
  | "formula";

/**
 * Structured formula — no raw Excel strings.
 */
export type FormulaConfig = {
  mode: PricingMode;
  /** Which numeric field drives the base (for composite formulas). */
  sourceField?:
    | "materialCost"
    | "baseCost"
    | "workCost"
    | "unitPrice"
    | "custom";
  coefficient?: number;
  /** Extra dimensions for future engine (min, max, step). */
  notes?: string;
};

export type SupplierSnapshot = {
  supplierId: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  unitPrice: number;
  currency: string;
  lastUpdated: string;
};

export type EstimateItem = {
  id: string;
  stableLineId: string;
  sectionId: string | null;
  position: number;
  itemType: EstimateItemType;
  name: string;
  category: string | null;
  description: string | null;
  material: string | null;
  facade: string | null;
  fittings: string | null;
  supplier: string | null;
  supplierCode: string | null;
  supplierItemName: string | null;
  supplierPrice: number | null;
  supplierSyncAt: string | null;
  manualOverride: boolean;
  width: number | null;
  height: number | null;
  depth: number | null;
  quantity: number;
  unit: string;
  area: number | null;
  length: number | null;
  baseCost: number | null;
  materialCost: number | null;
  hardwareCost: number | null;
  workCost: number | null;
  additionalCost: number | null;
  discountType: DiscountType;
  discountValue: number;
  marginPercent: number | null;
  pricingMode: PricingMode;
  formulaConfig: FormulaConfig | null;
  /** Unit sale (за шт / м² / м.п. залежно від режиму). */
  unitSalePrice: number;
  /** Рядок після знижки (продаж). */
  finalPrice: number;
  /** Internal total cost (себестоимость). */
  totalCost: number;
  comment: string | null;
  tags: string[];
  warnings: string[];
};

export type EstimateSection = {
  id: string;
  estimateVersionId: string;
  name: string;
  type: EstimateSectionType;
  position: number;
  note: string | null;
  isCollapsed: boolean;
  subtotalCost: number;
  subtotalSale: number;
  subtotalDiscount: number;
  subtotalMargin: number;
};

export type EstimateVersion = {
  id: string;
  leadId: string | null;
  dealId: string | null;
  versionNumber: number;
  versionName: string | null;
  status: EstimateVersionStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null };
  summary: string | null;
  sections: EstimateSection[];
  items: EstimateItem[];
  globalDiscountAmount: number;
  deliveryCost: number;
  installationCost: number;
  notes: string | null;
};

export type EstimateSummary = {
  totalCost: number;
  totalSale: number;
  totalDiscount: number;
  totalMargin: number;
  profitabilityPercent: number;
  sectionCount: number;
  itemCount: number;
  /** After global discount + delivery + install (aligned with CRM totals). */
  grandTotal: number;
};

export type EstimateWarningSeverity = "info" | "warning" | "danger";

export type EstimateWarning = {
  id: string;
  scope: "estimate" | "section" | "item";
  sectionId?: string;
  itemId?: string;
  severity: EstimateWarningSeverity;
  message: string;
};

/** Client / quote-facing row (no internal cost). */
export type QuoteLinePayload = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  sectionName: string;
  comment: string | null;
};

export type QuotePayload = {
  versionId: string;
  versionNumber: number;
  versionName: string | null;
  currency: string;
  sections: Array<{
    id: string;
    name: string;
    lines: QuoteLinePayload[];
    sectionSubtotal: number;
  }>;
  subtotal: number;
  discount: number;
  delivery: number;
  installation: number;
  grandTotal: number;
  notes: string | null;
  includeBreakdown: boolean;
  generatedAt: string;
};
