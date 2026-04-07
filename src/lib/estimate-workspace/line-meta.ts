import type { EstimateLineWorkspaceMeta } from "./types";

export function parseWorkspaceMeta(raw: unknown): EstimateLineWorkspaceMeta {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const base: EstimateLineWorkspaceMeta = {};
  if (typeof o.description === "string") base.description = o.description;
  if (typeof o.material === "string") base.material = o.material;
  if (typeof o.facade === "string") base.facade = o.facade;
  if (typeof o.hardware === "string") base.hardware = o.hardware;
  if (typeof o.widthMm === "number" && Number.isFinite(o.widthMm)) base.widthMm = o.widthMm;
  if (typeof o.heightMm === "number" && Number.isFinite(o.heightMm)) base.heightMm = o.heightMm;
  if (typeof o.depthMm === "number" && Number.isFinite(o.depthMm)) base.depthMm = o.depthMm;
  if (typeof o.areaM2 === "number" && Number.isFinite(o.areaM2)) base.areaM2 = o.areaM2;
  if (typeof o.lengthM === "number" && Number.isFinite(o.lengthM)) base.lengthM = o.lengthM;
  if (typeof o.calculationMode === "string") base.calculationMode = o.calculationMode as EstimateLineWorkspaceMeta["calculationMode"];
  if (typeof o.pricingMode === "string") base.pricingMode = o.pricingMode;
  if (typeof o.formulaLabel === "string") base.formulaLabel = o.formulaLabel;
  if (typeof o.formulaPreview === "string") base.formulaPreview = o.formulaPreview;
  if (typeof o.rowTag === "string") base.rowTag = o.rowTag;
  if (typeof o.clientVisible === "boolean") base.clientVisible = o.clientVisible;
  if (typeof o.pricingSource === "string") base.pricingSource = o.pricingSource;
  if (
    o.pricingConfidence === "approximate" ||
    o.pricingConfidence === "confirmed" ||
    o.pricingConfidence === "stale"
  ) {
    base.pricingConfidence = o.pricingConfidence;
  }
  if (typeof o.lastPriceUpdateAt === "string") base.lastPriceUpdateAt = o.lastPriceUpdateAt;
  if (typeof o.marginWarning === "string") base.marginWarning = o.marginWarning;
  if (typeof o.recommendedMarkup === "number" && Number.isFinite(o.recommendedMarkup)) {
    base.recommendedMarkup = o.recommendedMarkup;
  }
  if (o.isManualOverride === true) base.isManualOverride = true;
  if (typeof o.manualOverrideReason === "string") base.manualOverrideReason = o.manualOverrideReason;
  if (typeof o.productionNote === "string") base.productionNote = o.productionNote;
  if (typeof o.purchaseNote === "string") base.purchaseNote = o.purchaseNote;
  if (typeof o.supplierName === "string") base.supplierName = o.supplierName;
  if (typeof o.supplierSku === "string") base.supplierSku = o.supplierSku;
  if (typeof o.priceHistoryHint === "string") base.priceHistoryHint = o.priceHistoryHint;
  if (o.riskFlag === "info" || o.riskFlag === "warning" || o.riskFlag === "critical") {
    base.riskFlag = o.riskFlag;
  }
  if (o.estimateViewHints && typeof o.estimateViewHints === "object") {
    base.estimateViewHints = o.estimateViewHints as Record<string, unknown>;
  }
  if (o.supplier && typeof o.supplier === "object") {
    const s = o.supplier as Record<string, unknown>;
    base.supplier = {
      supplierName: typeof s.supplierName === "string" ? s.supplierName : null,
      supplierCode: typeof s.supplierCode === "string" ? s.supplierCode : null,
      supplierItemName: typeof s.supplierItemName === "string" ? s.supplierItemName : null,
      supplierPrice:
        typeof s.supplierPrice === "number" && Number.isFinite(s.supplierPrice)
          ? s.supplierPrice
          : null,
      lastSyncAt: typeof s.lastSyncAt === "string" ? s.lastSyncAt : null,
      manualOverride: s.manualOverride === true,
      catalogProviderId:
        typeof s.catalogProviderId === "string" ? s.catalogProviderId : null,
      externalItemId: typeof s.externalItemId === "string" ? s.externalItemId : null,
    };
  }
  if (typeof o.baseItemId === "string") base.baseItemId = o.baseItemId;
  return base;
}

export function mergeWorkspaceMeta(
  existing: unknown,
  patch: Partial<EstimateLineWorkspaceMeta>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object"
      ? { ...(existing as Record<string, unknown>) }
      : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) delete base[k];
    else base[k] = v;
  }
  return base;
}
