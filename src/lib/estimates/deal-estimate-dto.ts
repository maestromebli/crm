import type {
  EstimateLineType,
  EstimateStatus,
  Prisma,
} from "@prisma/client";

export type DealEstimateLineRow = {
  id: string;
  stableLineId: string;
  sortOrder: number;
  sectionId: string | null;
  type: EstimateLineType;
  category: string | null;
  code: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  costPrice: number | null;
  amountSale: number;
  amountCost: number | null;
  margin: number | null;
  supplierRef: string | null;
  notes: string | null;
  metadataJson: unknown;
};

export type DealEstimateSectionRow = {
  id: string;
  title: string;
  sortOrder: number;
  key: string | null;
};

export type DealEstimateAggregate = {
  id: string;
  dealId: string | null;
  leadId: string | null;
  name: string | null;
  version: number;
  status: EstimateStatus;
  isActive: boolean;
  isClientFacing: boolean;
  templateKey: string | null;
  changeSummary: string | null;
  settingsJson: unknown;
  totalPrice: number | null;
  totalCost: number | null;
  grossMargin: number | null;
  discountAmount: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  notes: string | null;
  createdById: string;
  createdBy?: { id: string; name: string | null } | null;
  approvedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  sections?: DealEstimateSectionRow[];
  lineItems: DealEstimateLineRow[];
};

export function dealEstimateToJson(e: DealEstimateAggregate): Record<string, unknown> {
  return {
    id: e.id,
    dealId: e.dealId,
    leadId: e.leadId,
    name: e.name ?? null,
    version: e.version,
    status: e.status,
    isActive: e.isActive,
    isClientFacing: e.isClientFacing,
    templateKey: e.templateKey ?? null,
    changeSummary: e.changeSummary ?? null,
    settingsJson: e.settingsJson ?? null,
    totalPrice: e.totalPrice,
    totalCost: e.totalCost,
    grossMargin: e.grossMargin,
    discountAmount: e.discountAmount,
    deliveryCost: e.deliveryCost,
    installationCost: e.installationCost,
    notes: e.notes,
    createdById: e.createdById,
    createdBy: e.createdBy
      ? { id: e.createdBy.id, name: e.createdBy.name }
      : { id: e.createdById, name: null },
    approvedById: e.approvedById,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    sections: (e.sections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sortOrder,
      key: s.key ?? null,
    })),
    lineItems: e.lineItems.map((li) => ({
      id: li.id,
      stableLineId: li.stableLineId,
      sortOrder: li.sortOrder,
      sectionId: li.sectionId,
      type: li.type,
      category: li.category,
      code: li.code,
      productName: li.productName,
      qty: li.qty,
      unit: li.unit,
      salePrice: li.salePrice,
      costPrice: li.costPrice,
      amountSale: li.amountSale,
      amountCost: li.amountCost,
      margin: li.margin,
      supplierRef: li.supplierRef,
      notes: li.notes,
      metadataJson: li.metadataJson,
    })),
  };
}

export const DEAL_ESTIMATE_INCLUDE = {
  sections: { orderBy: { sortOrder: "asc" as const } },
  lineItems: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.EstimateInclude;
