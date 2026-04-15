export type EstimateCoreItemInput = {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  category?: string;
  note?: string;
};

export type EstimateCoreItemResult = {
  lineCost: number;
  lineRevenue: number;
  lineMargin: number;
  lineMarginPercent: number;
  warnings: string[];
};

export type EstimateCoreComputedItem = EstimateCoreItemInput & EstimateCoreItemResult;

export type EstimateCoreMargin = {
  grossProfit: number;
  marginPercent: number;
  riskLevel: "low" | "medium" | "high";
};

export type EstimateCoreSummary = EstimateCoreMargin & {
  itemCount: number;
  warningCount: number;
  topRiskItems: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
  totalCost: number;
  totalRevenue: number;
};
