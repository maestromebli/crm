import type { EstimateLineType, EstimateStatus } from "@prisma/client";

type EstimateApiLine = {
  id: string;
  type: EstimateLineType;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  costPrice: number | null;
  amountSale: number;
  amountCost: number | null;
  margin: number | null;
  metadataJson: unknown;
};

type EstimateApiRow = {
  id: string;
  version: number;
  status: EstimateStatus;
  totalPrice: number | null;
  totalCost: number | null;
  grossMargin: number | null;
  discountAmount: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  notes: string | null;
  createdById: string;
  approvedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems?: EstimateApiLine[];
  leadId?: string | null;
  dealId?: string | null;
};

export function estimateApiRowToJson(e: EstimateApiRow) {
  return {
    id: e.id,
    ...("leadId" in e ? { leadId: e.leadId ?? null } : {}),
    ...("dealId" in e ? { dealId: e.dealId ?? null } : {}),
    version: e.version,
    status: e.status,
    totalPrice: e.totalPrice,
    totalCost: e.totalCost,
    grossMargin: e.grossMargin,
    discountAmount: e.discountAmount,
    deliveryCost: e.deliveryCost,
    installationCost: e.installationCost,
    notes: e.notes,
    createdById: e.createdById,
    approvedById: e.approvedById,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    lineItems: (e.lineItems ?? []).map((li) => ({
      id: li.id,
      type: li.type,
      category: li.category,
      productName: li.productName,
      qty: li.qty,
      unit: li.unit,
      salePrice: li.salePrice,
      costPrice: li.costPrice,
      amountSale: li.amountSale,
      amountCost: li.amountCost,
      margin: li.margin,
      metadataJson: li.metadataJson,
    })),
  };
}
