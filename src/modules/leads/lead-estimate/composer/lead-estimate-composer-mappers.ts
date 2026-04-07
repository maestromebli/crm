import type { CompareEstimateVersionsResult } from "../../../../lib/estimates/compare-estimate-versions";
import {
  ESTIMATE_CATEGORY_LABELS,
  type EstimateCategoryKey,
  parseCategoryKey,
} from "../../../../lib/estimates/estimate-categories";
import { buildEstimateLinePayload } from "../../../../lib/estimates/build-estimate-line-payload";
import type {
  ChangedField,
  ChangedItem,
  DiffResult,
  DraftItem,
  EstimateVersionModel,
  SupplierPriceSnapshot,
  UnitPriceSource,
  VersionItem,
  VersionStatusUi,
} from "./lead-estimate-composer-types";

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function calcLineTotal(
  qty: number,
  coefficient: number,
  unitPrice: number,
) {
  return roundMoney(qty * coefficient * unitPrice);
}

function parseMeta(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, unknown>;
}

function snapshotFromMeta(
  meta: Record<string, unknown>,
  fallbackPrice: number,
): SupplierPriceSnapshot | null {
  const supplier =
    typeof meta.supplierProvider === "string" ? meta.supplierProvider : null;
  const materialId =
    typeof meta.supplierMaterialId === "string" ? meta.supplierMaterialId : null;
  const materialName =
    typeof meta.supplierMaterialName === "string"
      ? meta.supplierMaterialName
      : "";
  if (!supplier?.trim() || !materialId?.trim()) return null;
  const snap =
    typeof meta.supplierPriceSnapshot === "number" &&
    Number.isFinite(meta.supplierPriceSnapshot)
      ? meta.supplierPriceSnapshot
      : fallbackPrice;
  return {
    supplier: supplier.trim(),
    materialId: materialId.trim(),
    materialCode:
      typeof meta.supplierMaterialCode === "string"
        ? meta.supplierMaterialCode
        : "",
    materialName,
    price: snap,
    currency: "UAH",
    capturedAt: new Date().toISOString(),
  };
}

function inferUnitPriceSource(
  salePrice: number,
  meta: Record<string, unknown>,
): UnitPriceSource {
  if (meta.unitPriceSource === "manual") return "manual";
  if (meta.unitPriceSource === "supplier_snapshot") return "supplier_snapshot";
  const snap = meta.supplierPriceSnapshot;
  if (
    typeof snap === "number" &&
    Number.isFinite(snap) &&
    Math.abs(snap - salePrice) < 0.02
  ) {
    return "supplier_snapshot";
  }
  return "manual";
}

export function apiLineToVersionItem(
  li: {
    id: string;
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    salePrice: number;
    amountSale: number;
    metadataJson?: unknown;
  },
  sortOrder: number,
): VersionItem {
  const meta = parseMeta(li.metadataJson);
  const coeffRaw = meta.coefficient;
  const coefficient =
    typeof coeffRaw === "string" && Number(coeffRaw) > 0
      ? Number(String(coeffRaw).replace(",", "."))
      : typeof coeffRaw === "number" && coeffRaw > 0
        ? coeffRaw
        : 1;
  const categoryKey = parseCategoryKey(li.category);
  const snap = snapshotFromMeta(meta, li.salePrice);
  return {
    id: li.id,
    sortOrder,
    categoryKey,
    title: li.productName,
    qty: li.qty,
    coefficient,
    unitPrice: li.salePrice,
    totalPrice: li.amountSale,
    supplier:
      typeof meta.supplierProvider === "string" ? meta.supplierProvider : null,
    supplierMaterialId:
      typeof meta.supplierMaterialId === "string"
        ? meta.supplierMaterialId
        : null,
    supplierMaterialCode:
      typeof meta.supplierMaterialCode === "string"
        ? meta.supplierMaterialCode
        : null,
    supplierMaterialName:
      typeof meta.supplierMaterialName === "string"
        ? meta.supplierMaterialName
        : null,
    supplierPriceSnapshot: snap,
    unitPriceSource: inferUnitPriceSource(li.salePrice, meta),
    note: typeof meta.note === "string" ? meta.note : null,
  };
}

export function apiEstimateToVersionModel(args: {
  id: string;
  version: number;
  status: string;
  totalPrice: number | null;
  changeSummary: string | null;
  createdAt: string;
  updatedAt?: string;
  createdByName: string | null;
  isActiveCurrent: boolean;
  lineItems: Array<{
    id: string;
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    salePrice: number;
    amountSale: number;
    metadataJson?: unknown;
  }>;
}): EstimateVersionModel {
  const items = args.lineItems.map((li, i) => apiLineToVersionItem(li, i + 1));
  const subtotal = roundMoney(
    items.reduce((s, x) => s + x.totalPrice, 0),
  );
  const total = args.totalPrice ?? subtotal;
  let statusUi: VersionStatusUi = "archived";
  if (args.status === "DRAFT") statusUi = "draft";
  else if (args.isActiveCurrent) statusUi = "current";
  else if (args.status === "SUPERSEDED") statusUi = "archived";
  else statusUi = "archived";

  return {
    id: args.id,
    versionNumber: args.version,
    status: statusUi,
    changeNote: args.changeSummary,
    currency: "UAH",
    createdAt: args.createdAt,
    createdBy: args.createdByName ?? "—",
    items,
    subtotal,
    total,
  };
}

export function toDraftItem(item: VersionItem): DraftItem {
  return {
    tempId: `draft_${item.id}`,
    baseItemId: item.id,
    sortOrder: item.sortOrder,
    categoryKey: item.categoryKey,
    title: item.title,
    qty: item.qty,
    coefficient: item.coefficient,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    supplier: item.supplier,
    supplierMaterialId: item.supplierMaterialId,
    supplierMaterialCode: item.supplierMaterialCode,
    supplierMaterialName: item.supplierMaterialName,
    supplierPriceSnapshot: item.supplierPriceSnapshot,
    unitPriceSource: item.unitPriceSource,
    note: item.note ?? "",
  };
}

export function emptyDraftItem(order: number): DraftItem {
  return recalcDraftItem({
    tempId: `temp_${Math.random().toString(36).slice(2)}`,
    sortOrder: order,
    categoryKey: "cabinets",
    title: "",
    qty: 1,
    coefficient: 1,
    unitPrice: 0,
    totalPrice: 0,
    supplier: null,
    supplierMaterialId: null,
    supplierMaterialCode: null,
    supplierMaterialName: null,
    supplierPriceSnapshot: null,
    unitPriceSource: "manual",
    note: "",
  });
}

export function recalcDraftItem(item: DraftItem): DraftItem {
  return {
    ...item,
    totalPrice: calcLineTotal(item.qty, item.coefficient, item.unitPrice),
  };
}

export function recalcVersionTotals(items: { totalPrice: number }[]) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.totalPrice, 0));
  return { subtotal, total: subtotal };
}

export function itemFingerprintFields(
  base: VersionItem,
  draft: DraftItem,
): ChangedField[] {
  const changes: ChangedField[] = [];
  const push = (
    field: string,
    from: string | number | null,
    to: string | number | null,
  ) => {
    if (from !== to) changes.push({ field, from, to });
  };
  push(
    "category",
    ESTIMATE_CATEGORY_LABELS[base.categoryKey],
    ESTIMATE_CATEGORY_LABELS[draft.categoryKey],
  );
  push("title", base.title, draft.title);
  push("qty", base.qty, draft.qty);
  push("coefficient", base.coefficient, draft.coefficient);
  push("unitPrice", base.unitPrice, draft.unitPrice);
  push("supplier", base.supplier, draft.supplier);
  push(
    "materialCode",
    base.supplierMaterialCode,
    draft.supplierMaterialCode,
  );
  push("note", base.note ?? null, draft.note ?? null);
  return changes;
}

export function computeDiff(
  baseVersion: EstimateVersionModel,
  draftItems: DraftItem[],
): DiffResult {
  const baseById = new Map(baseVersion.items.map((item) => [item.id, item]));
  const draftByBaseId = new Map(
    draftItems
      .filter((i) => i.baseItemId)
      .map((item) => [item.baseItemId as string, item]),
  );

  const added = draftItems.filter((item) => !item.baseItemId);
  const removed = baseVersion.items.filter((item) => !draftByBaseId.has(item.id));
  const changed: ChangedItem[] = [];

  for (const draft of draftItems) {
    if (!draft.baseItemId) continue;
    const base = baseById.get(draft.baseItemId);
    if (!base) continue;
    const fields = itemFingerprintFields(base, draft);
    if (fields.length > 0) {
      changed.push({
        baseItemId: base.id,
        title: draft.title || base.title,
        fields,
        beforeTotal: base.totalPrice,
        afterTotal: draft.totalPrice,
      });
    }
  }

  const baseTotal = baseVersion.total;
  const draftTotal = recalcVersionTotals(draftItems).total;

  return {
    added,
    removed,
    changed,
    totalDelta: roundMoney(draftTotal - baseTotal),
  };
}

export function draftItemsToLinePayload(items: DraftItem[]) {
  const rows = items
    .filter((i) => i.title.trim().length > 0)
    .map((item) => ({
      categoryKey: item.categoryKey,
      productName: item.title.trim(),
      qty: String(item.qty),
      coefficient: String(item.coefficient),
      unit: "шт",
      salePrice: String(item.unitPrice),
      supplierProvider: item.supplier,
      supplierMaterialId: item.supplierMaterialId,
      supplierMaterialName: item.supplierMaterialName,
      supplierPriceSnapshot: item.supplierPriceSnapshot?.price ?? null,
      baseItemId: item.baseItemId ?? null,
      unitPriceSource: item.unitPriceSource,
    }));
  return buildEstimateLinePayload(rows);
}

export function materialHitToSnapshot(
  m: {
    supplier: string;
    materialId: string;
    code: string;
    name: string;
    price: number;
    currency: string;
  },
): SupplierPriceSnapshot {
  return {
    supplier: m.supplier,
    materialId: m.materialId,
    materialCode: m.code,
    materialName: m.name,
    price: m.price,
    currency: m.currency,
    capturedAt: new Date().toISOString(),
  };
}

/** Для DiffPreview: результат порівняння з API. */
export function compareApiToDiffResult(
  r: CompareEstimateVersionsResult,
): DiffResult {
  const added: DraftItem[] = (r.addedItems ?? []).map((a, i) =>
    recalcDraftItem({
      tempId: `cmp_add_${i}`,
      sortOrder: i + 1,
      categoryKey: "extras",
      title: a.title,
      qty: a.qty,
      coefficient: 1,
      unitPrice: a.unitPrice,
      totalPrice: a.totalPrice,
      supplier: null,
      supplierMaterialId: null,
      supplierMaterialCode: null,
      supplierMaterialName: null,
      supplierPriceSnapshot: null,
      unitPriceSource: "manual",
      note: "",
    }),
  );

  const removed: VersionItem[] = (r.removedItems ?? []).map((x, i) => ({
    id: `cmp_rm_${i}`,
    sortOrder: i + 1,
    categoryKey: "extras",
    title: x.title,
    qty: x.qty,
    coefficient: 1,
    unitPrice: x.unitPrice,
    totalPrice: x.totalPrice,
    supplier: null,
    supplierMaterialId: null,
    supplierMaterialCode: null,
    supplierMaterialName: null,
    supplierPriceSnapshot: null,
    unitPriceSource: "manual",
    note: null,
  }));

  const changed: ChangedItem[] = (r.changedItems ?? []).map((c, i) => ({
    baseItemId: `cmp_ch_${i}`,
    title: c.title,
    fields: (c.fields ?? []).map((f) => ({
      field: f.field,
      from: f.from,
      to: f.to,
    })),
    beforeTotal: 0,
    afterTotal: 0,
  }));

  return {
    added,
    removed,
    changed,
    totalDelta: r.summary?.totalDelta ?? 0,
  };
}
