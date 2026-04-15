export type PricingItemInput = {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  category?: string;
  note?: string;
};

export type PricingItemResult = {
  lineCost: number;
  lineRevenue: number;
  lineMargin: number;
  lineMarginPercent: number;
  warnings: string[];
};

export type PricingComputedItem = PricingItemInput & PricingItemResult;

export type PricingTotals = {
  totalCost: number;
  totalRevenue: number;
  grossProfit: number;
  marginPercent: number;
  riskLevel: "low" | "medium" | "high";
};

export type PricingSummary = {
  itemCount: number;
  warningCount: number;
  topRiskItems: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
};

export type PricingCalculationResult = {
  items: PricingComputedItem[];
  totals: PricingTotals;
  summary: PricingSummary;
};
