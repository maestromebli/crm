import type { EstimateLineType } from "@prisma/client";
import type {
  EstimateItem,
  EstimateItemType,
  EstimateSection,
  EstimateSectionType,
  PricingMode,
} from "../types/domain";
import type { FormulaConfig } from "../types/domain";
import { recalculateEstimateItem } from "../utils/calculations";

export const ITEM_META_V = 2 as const;

export type ItemMetadataV2 = {
  v: typeof ITEM_META_V;
  description?: string | null;
  material?: string | null;
  facade?: string | null;
  fittings?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  depthMm?: number | null;
  lengthM?: number | null;
  baseCost?: number | null;
  materialCost?: number | null;
  hardwareCost?: number | null;
  workCost?: number | null;
  additionalCost?: number | null;
  discountType?: "fixed" | "percent";
  discountValue?: number;
  pricingMode?: PricingMode;
  formulaConfig?: FormulaConfig | null;
  itemType?: EstimateItemType;
  supplier?: {
    supplierName?: string | null;
    supplierCode?: string | null;
    supplierItemName?: string | null;
    supplierPrice?: number | null;
    /** ISO sync time; alias `supplierSyncAt` accepted when parsing legacy JSON */
    lastSyncAt?: string | null;
    supplierSyncAt?: string | null;
    manualOverride?: boolean;
    catalogProviderId?: string | null;
    externalItemId?: string | null;
  };
  tags?: string[];
};

export type LineModel = {
  id: string;
  stableLineId: string;
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
  supplierRef: string | null;
  notes: string | null;
  metadataJson: Record<string, unknown>;
  sortOrder: number;
};

export type SectionModel = {
  id: string;
  title: string;
  sortOrder: number;
  key: string | null;
};

function parseMeta(raw: unknown): ItemMetadataV2 {
  if (!raw || typeof raw !== "object") return { v: ITEM_META_V };
  const o = raw as Record<string, unknown>;
  if (o.v !== ITEM_META_V && o.v !== 1) {
    return migrateLegacyMeta(o);
  }
  return {
    v: ITEM_META_V,
    description: typeof o.description === "string" ? o.description : null,
    material: typeof o.material === "string" ? o.material : null,
    facade: typeof o.facade === "string" ? o.facade : null,
    fittings: typeof o.fittings === "string" ? o.fittings : null,
    widthMm: typeof o.widthMm === "number" ? o.widthMm : null,
    heightMm: typeof o.heightMm === "number" ? o.heightMm : null,
    depthMm: typeof o.depthMm === "number" ? o.depthMm : null,
    lengthM: typeof o.lengthM === "number" ? o.lengthM : null,
    baseCost: typeof o.baseCost === "number" ? o.baseCost : null,
    materialCost: typeof o.materialCost === "number" ? o.materialCost : null,
    hardwareCost: typeof o.hardwareCost === "number" ? o.hardwareCost : null,
    workCost: typeof o.workCost === "number" ? o.workCost : null,
    additionalCost: typeof o.additionalCost === "number" ? o.additionalCost : null,
    discountType:
      o.discountType === "fixed" || o.discountType === "percent"
        ? o.discountType
        : "fixed",
    discountValue:
      typeof o.discountValue === "number" && Number.isFinite(o.discountValue)
        ? o.discountValue
        : 0,
    pricingMode: isPricingMode(o.pricingMode) ? o.pricingMode : undefined,
    formulaConfig:
      o.formulaConfig && typeof o.formulaConfig === "object"
        ? (o.formulaConfig as FormulaConfig)
        : null,
    itemType: isItemType(o.itemType) ? o.itemType : undefined,
    supplier:
      o.supplier && typeof o.supplier === "object"
        ? (o.supplier as ItemMetadataV2["supplier"])
        : undefined,
    tags: Array.isArray(o.tags)
      ? o.tags.filter((t): t is string => typeof t === "string")
      : undefined,
  };
}

function migrateLegacyMeta(o: Record<string, unknown>): ItemMetadataV2 {
  if (typeof o.pricingMode === "string" && isPricingMode(o.pricingMode)) {
    return {
      v: ITEM_META_V,
      material: typeof o.material === "string" ? o.material : null,
      facade: typeof o.facade === "string" ? o.facade : null,
      widthMm: typeof o.widthMm === "number" ? o.widthMm : null,
      heightMm: typeof o.heightMm === "number" ? o.heightMm : null,
      depthMm: typeof o.depthMm === "number" ? o.depthMm : null,
      pricingMode: o.pricingMode,
      discountType: "fixed",
      discountValue: 0,
      supplier:
        o.supplier && typeof o.supplier === "object"
          ? (o.supplier as ItemMetadataV2["supplier"])
          : undefined,
    };
  }
  const legacyMode = o.calculationMode;
  const pricingMode: PricingMode =
    legacyMode === "by_area"
      ? "area"
      : legacyMode === "running_meter"
        ? "length"
        : legacyMode === "by_qty"
          ? "quantity"
          : legacyMode === "module"
            ? "module"
            : legacyMode === "custom_formula"
              ? "formula"
              : legacyMode === "manual"
                ? "manual"
                : "quantity";
  return {
    v: ITEM_META_V,
    material: typeof o.material === "string" ? o.material : null,
    facade: typeof o.facade === "string" ? o.facade : null,
    widthMm: typeof o.widthMm === "number" ? o.widthMm : null,
    heightMm: typeof o.heightMm === "number" ? o.heightMm : null,
    depthMm: typeof o.depthMm === "number" ? o.depthMm : null,
    pricingMode,
    discountType: "fixed",
    discountValue: 0,
    supplier:
      o.supplier && typeof o.supplier === "object"
        ? (o.supplier as ItemMetadataV2["supplier"])
        : undefined,
  };
}

function isPricingMode(x: unknown): x is PricingMode {
  return (
    x === "manual" ||
    x === "quantity" ||
    x === "area" ||
    x === "length" ||
    x === "module" ||
    x === "formula"
  );
}

function isItemType(x: unknown): x is EstimateItemType {
  return (
    x === "product" ||
    x === "material" ||
    x === "hardware" ||
    x === "service" ||
    x === "custom"
  );
}

export function prismaTypeToItemType(t: EstimateLineType): EstimateItemType {
  switch (t) {
    case "PRODUCT":
      return "product";
    case "MATERIAL":
      return "material";
    case "FITTING":
      return "hardware";
    case "SERVICE":
    case "DELIVERY":
    case "INSTALLATION":
    case "WORK":
      return "service";
    default:
      return "custom";
  }
}

export function itemTypeToPrisma(t: EstimateItemType): EstimateLineType {
  switch (t) {
    case "product":
      return "PRODUCT";
    case "material":
      return "MATERIAL";
    case "hardware":
      return "FITTING";
    case "service":
      return "SERVICE";
    default:
      return "OTHER";
  }
}

export function lineModelToEstimateItem(
  line: LineModel,
  estimateVersionId: string,
): EstimateItem {
  const m = parseMeta(line.metadataJson);
  const itemType = m.itemType ?? prismaTypeToItemType(line.type);
  const pricingMode: PricingMode = m.pricingMode ?? "quantity";
  const discountType = m.discountType ?? "fixed";
  const discountValue = m.discountValue ?? 0;

  const item: EstimateItem = {
    id: line.id,
    stableLineId: line.stableLineId,
    sectionId: line.sectionId,
    position: line.sortOrder,
    itemType,
    name: line.productName,
    category: line.category,
    description: m.description ?? null,
    material: m.material ?? null,
    facade: m.facade ?? null,
    fittings: m.fittings ?? null,
    supplier: m.supplier?.supplierName ?? line.supplierRef,
    supplierCode: m.supplier?.supplierCode ?? line.code,
    supplierItemName: m.supplier?.supplierItemName ?? null,
    supplierPrice: m.supplier?.supplierPrice ?? null,
    supplierSyncAt:
      m.supplier?.lastSyncAt ??
      m.supplier?.supplierSyncAt ??
      null,
    manualOverride: m.supplier?.manualOverride ?? false,
    width: m.widthMm ?? null,
    height: m.heightMm ?? null,
    depth: m.depthMm ?? null,
    quantity: line.qty,
    unit: line.unit,
    area: null,
    length: m.lengthM ?? null,
    baseCost: m.baseCost ?? null,
    materialCost: m.materialCost ?? null,
    hardwareCost: m.hardwareCost ?? null,
    workCost: m.workCost ?? null,
    additionalCost: m.additionalCost ?? null,
    discountType,
    discountValue,
    marginPercent: null,
    pricingMode,
    formulaConfig: m.formulaConfig ?? null,
    unitSalePrice: line.salePrice,
    finalPrice: line.amountSale,
    totalCost: line.amountCost ?? calculateItemCostFromParts(m, line),
    comment: line.notes,
    tags: m.tags ?? [],
    warnings: [],
  };
  return recalculateEstimateItem(item);
}

function calculateItemCostFromParts(
  m: ItemMetadataV2,
  line: LineModel,
): number {
  if (line.costPrice != null && Number.isFinite(line.costPrice)) {
    return line.costPrice * line.qty;
  }
  const parts = [
    m.baseCost ?? 0,
    m.materialCost ?? 0,
    m.hardwareCost ?? 0,
    m.workCost ?? 0,
    m.additionalCost ?? 0,
  ];
  return parts.reduce((a, b) => a + b, 0);
}

export function estimateItemToLineModel(item: EstimateItem): LineModel {
  const meta: ItemMetadataV2 = {
    v: ITEM_META_V,
    description: item.description,
    material: item.material,
    facade: item.facade,
    fittings: item.fittings,
    widthMm: item.width,
    heightMm: item.height,
    depthMm: item.depth,
    lengthM: item.length,
    baseCost: item.baseCost,
    materialCost: item.materialCost,
    hardwareCost: item.hardwareCost,
    workCost: item.workCost,
    additionalCost: item.additionalCost,
    discountType: item.discountType,
    discountValue: item.discountValue,
    pricingMode: item.pricingMode,
    formulaConfig: item.formulaConfig,
    itemType: item.itemType,
    supplier: {
      supplierName: item.supplier,
      supplierCode: item.supplierCode,
      supplierItemName: item.supplierItemName,
      supplierPrice: item.supplierPrice,
      lastSyncAt: item.supplierSyncAt,
      manualOverride: item.manualOverride,
    },
    tags: item.tags,
  };

  const costPerUnit =
    item.quantity > 0 ? item.totalCost / item.quantity : null;

  return {
    id: item.id,
    stableLineId: item.stableLineId,
    sectionId: item.sectionId,
    type: itemTypeToPrisma(item.itemType),
    category: item.category,
    code: item.supplierCode,
    productName: item.name,
    qty: item.quantity,
    unit: item.unit,
    salePrice: item.unitSalePrice,
    costPrice: costPerUnit,
    amountSale: item.finalPrice,
    amountCost: item.totalCost,
    supplierRef: item.supplier,
    notes: item.comment,
    metadataJson: meta as unknown as Record<string, unknown>,
    sortOrder: item.position,
  };
}

export function sectionKeyToType(key: string | null): EstimateSectionType {
  if (!key) return "room";
  const k = key.toLowerCase();
  if (k.includes("delivery") || k.includes("достав")) return "delivery";
  if (k.includes("install") || k.includes("монта")) return "installation";
  if (k.includes("service") || k.includes("послуг")) return "service";
  if (k.includes("general") || k.includes("загаль")) return "other";
  return "room";
}

/** Повний цикл: доменний перерахунок суми/маржі після редагування. */
export function normalizeLineModel(
  line: LineModel,
  estimateVersionId: string,
): LineModel {
  const item = lineModelToEstimateItem(line, estimateVersionId);
  const rec = recalculateEstimateItem(item);
  return estimateItemToLineModel(rec);
}

export function sectionModelToEstimateSection(
  s: SectionModel,
  estimateVersionId: string,
  settings: { note?: string | null; isCollapsed?: boolean; type?: EstimateSectionType },
): EstimateSection {
  return {
    id: s.id,
    estimateVersionId,
    name: s.title,
    type: settings.type ?? sectionKeyToType(s.key),
    position: s.sortOrder,
    note: settings.note ?? null,
    isCollapsed: settings.isCollapsed ?? false,
    subtotalCost: 0,
    subtotalSale: 0,
    subtotalDiscount: 0,
    subtotalMargin: 0,
  };
}
