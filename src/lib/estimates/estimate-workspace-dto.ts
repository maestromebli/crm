/**
 * Spec-aligned DTOs for GET /api/leads/:leadId/estimate-workspace.
 * DB model: one `Estimate` row per version (no separate EstimateVersion table).
 */
import type { EstimateStatus } from "@prisma/client";

export type UnitPriceSourceDto = "manual" | "supplier_snapshot";

export type SupplierPriceSnapshotDto = {
  supplier: string;
  materialId: string;
  materialCode?: string | null;
  materialName: string;
  price: number;
  currency: string;
  capturedAt: string;
};

export type EstimateVersionItemDto = {
  id: string;
  sortOrder: number;
  /** Стабільний id для дифів між версіями. */
  stableLineId: string;
  sectionId?: string | null;
  category?: string | null;
  code?: string | null;
  title: string;
  qty: number;
  coefficient: number;
  unitPrice: number;
  totalPrice: number;
  supplier?: string | null;
  supplierMaterialId?: string | null;
  supplierMaterialCode?: string | null;
  supplierMaterialName?: string | null;
  supplierPriceSnapshot?: SupplierPriceSnapshotDto | null;
  supplierRef?: string | null;
  unitPriceSource: UnitPriceSourceDto;
  /** Об’єднане відображення (metadata.note або notes з БД). */
  note?: string | null;
};

export type EstimateVersionStatusDto = "draft" | "current" | "archived";

export type EstimateVersionDto = {
  id: string;
  estimateId: string;
  versionNumber: number;
  status: EstimateVersionStatusDto;
  baseVersionId?: string | null;
  changeNote?: string | null;
  subtotal: number;
  total: number;
  currency: string;
  createdAt: string;
  createdBy?: { id: string; name?: string | null } | null;
  items: EstimateVersionItemDto[];
};

export type EstimateVersionListItemDto = {
  id: string;
  estimateId: string;
  versionNumber: number;
  status: EstimateVersionStatusDto;
  author?: { id: string; name?: string | null } | null;
  createdAt: string;
  total: number | null;
  changeNote?: string | null;
};

export type LeadMiniWorkspaceDto = {
  id: string;
  title: string;
  customerName?: string | null;
  phone?: string | null;
  stage?: string | null;
};

export type EstimateMiniDto = {
  id: string;
  name: string | null;
  currency: string;
  currentVersionId: string | null;
};

export type EstimateWorkspaceResponse = {
  lead: LeadMiniWorkspaceDto;
  estimate: EstimateMiniDto | null;
  currentVersion: EstimateVersionDto | null;
  versionHistory: EstimateVersionListItemDto[];
};

type LineRow = {
  id: string;
  sortOrder: number;
  stableLineId: string;
  sectionId: string | null;
  category: string | null;
  code: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  amountSale: number;
  supplierRef: string | null;
  notes: string | null;
  metadataJson: unknown;
};

function parseLineMetadataJson(raw: unknown): {
  supplierProvider?: string | null;
  supplierMaterialId?: string | null;
  supplierMaterialName?: string | null;
  supplierPriceSnapshot?: number | null;
  unitPriceSource?: string | null;
  note?: string | null;
} {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    supplierProvider:
      typeof o.supplierProvider === "string" ? o.supplierProvider : null,
    supplierMaterialId:
      typeof o.supplierMaterialId === "string" ? o.supplierMaterialId : null,
    supplierMaterialName:
      typeof o.supplierMaterialName === "string"
        ? o.supplierMaterialName
        : null,
    supplierPriceSnapshot:
      typeof o.supplierPriceSnapshot === "number" &&
      Number.isFinite(o.supplierPriceSnapshot)
        ? o.supplierPriceSnapshot
        : null,
    unitPriceSource:
      typeof o.unitPriceSource === "string" ? o.unitPriceSource : null,
    note: typeof o.note === "string" ? o.note : null,
  };
}

function snapshotFromMeta(
  meta: ReturnType<typeof parseLineMetadataJson>,
): SupplierPriceSnapshotDto | null {
  const snap = meta.supplierPriceSnapshot;
  if (
    snap == null ||
    !meta.supplierProvider?.trim() ||
    !meta.supplierMaterialId?.trim()
  ) {
    return null;
  }
  return {
    supplier: meta.supplierProvider.trim(),
    materialId: meta.supplierMaterialId.trim(),
    materialCode: null,
    materialName: meta.supplierMaterialName?.trim() ?? "",
    price: snap,
    currency: "UAH",
    capturedAt: new Date().toISOString(),
  };
}

function inferUnitPriceSource(
  salePrice: number,
  meta: ReturnType<typeof parseLineMetadataJson>,
): UnitPriceSourceDto {
  if (meta.unitPriceSource === "manual") return "manual";
  if (meta.unitPriceSource === "supplier_snapshot") return "supplier_snapshot";
  const snap = meta.supplierPriceSnapshot;
  if (
    snap != null &&
    Number.isFinite(snap) &&
    Math.abs(snap - salePrice) < 0.02
  ) {
    return "supplier_snapshot";
  }
  return "manual";
}

export function mapLineToEstimateVersionItemDto(
  line: LineRow,
  sortOrder: number,
): EstimateVersionItemDto {
  const meta = parseLineMetadataJson(line.metadataJson);
  const coeff = 1;
  const unitPrice = line.salePrice;
  const totalPrice = line.amountSale;
  return {
    id: line.id,
    sortOrder,
    stableLineId: line.stableLineId,
    sectionId: line.sectionId,
    category: line.category,
    code: line.code,
    title: line.productName,
    qty: line.qty,
    coefficient: coeff,
    unitPrice,
    totalPrice,
    supplier: meta.supplierProvider,
    supplierMaterialId: meta.supplierMaterialId,
    supplierMaterialCode: null,
    supplierMaterialName: meta.supplierMaterialName,
    supplierPriceSnapshot: snapshotFromMeta(meta),
    supplierRef: line.supplierRef,
    unitPriceSource: inferUnitPriceSource(line.salePrice, meta),
    note: line.notes ?? meta.note ?? null,
  };
}

function mapStatus(
  row: { id: string; status: EstimateStatus },
  activeEstimateId: string | null,
): EstimateVersionStatusDto {
  if (activeEstimateId && row.id === activeEstimateId) return "current";
  if (row.status === "SUPERSEDED") return "archived";
  if (row.status === "DRAFT") return "draft";
  return "archived";
}

export function mapEstimateRowToVersionDto(
  row: {
    id: string;
    version: number;
    status: EstimateStatus;
    totalPrice: number | null;
    changeSummary: string | null;
    createdAt: Date;
    createdById: string;
    createdBy?: { id: string; name: string | null } | null;
    lineItems: LineRow[];
  },
  args: {
    containerEstimateId: string;
    activeEstimateId: string | null;
  },
): EstimateVersionDto {
  const items = row.lineItems.map((li, i) =>
    mapLineToEstimateVersionItemDto(li, li.sortOrder ?? i),
  );
  const sumSale = row.lineItems.reduce((a, l) => a + l.amountSale, 0);
  const subtotal = sumSale;
  return {
    id: row.id,
    estimateId: args.containerEstimateId,
    versionNumber: row.version,
    status: mapStatus(row, args.activeEstimateId),
    baseVersionId: null,
    changeNote: row.changeSummary,
    subtotal,
    total: row.totalPrice ?? 0,
    currency: "UAH",
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy
      ? { id: row.createdBy.id, name: row.createdBy.name }
      : { id: row.createdById, name: null },
    items,
  };
}

export function mapEstimateToListItemDto(
  row: {
    id: string;
    version: number;
    status: EstimateStatus;
    totalPrice: number | null;
    changeSummary: string | null;
    createdAt: Date;
    createdById: string;
    createdBy?: { id: string; name: string | null } | null;
  },
  args: {
    containerEstimateId: string;
    activeEstimateId: string | null;
  },
): EstimateVersionListItemDto {
  return {
    id: row.id,
    estimateId: args.containerEstimateId,
    versionNumber: row.version,
    status: mapStatus(row, args.activeEstimateId),
    author: row.createdBy
      ? { id: row.createdBy.id, name: row.createdBy.name }
      : { id: row.createdById, name: null },
    createdAt: row.createdAt.toISOString(),
    total: row.totalPrice,
    changeNote: row.changeSummary,
  };
}
