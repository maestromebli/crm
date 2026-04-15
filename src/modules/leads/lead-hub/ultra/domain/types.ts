export type LeadHubFileRole = "IMAGE" | "CALC_SOURCE" | "DOC";

export type LeadHubPricingItem = {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  category?: string;
  note?: string;
  lineCost?: number;
  lineRevenue?: number;
  lineMargin?: number;
  lineMarginPercent?: number;
  warnings?: string[];
};

export type LeadHubSessionDto = {
  id: string;
  title: string | null;
  status: "DRAFT" | "ACTIVE" | "CONVERTED" | "ARCHIVED";
  previewImage: string | null;
  pricingSessionId: string;
  currency: string;
  canViewMargin: boolean;
  totals: {
    totalCost: number;
    totalRevenue: number;
    grossProfit: number;
    marginPercent: number;
    riskLevel: "low" | "medium" | "high";
  };
  summary: {
    itemCount: number;
    warningCount: number;
    topRiskItems: Array<{
      id: string;
      name: string;
      reason: string;
    }>;
  };
  items: LeadHubPricingItem[];
  files: Array<{
    id: string;
    role: LeadHubFileRole;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};
