import type { EstimateLineType } from "@prisma/client";

export type CalculationMode =
  | "manual"
  | "by_qty"
  | "by_area"
  | "running_meter"
  | "module"
  | "custom_formula";

export type SupplierRefMeta = {
  supplierName?: string | null;
  supplierCode?: string | null;
  supplierItemName?: string | null;
  supplierPrice?: number | null;
  lastSyncAt?: string | null;
  manualOverride?: boolean;
  catalogProviderId?: string | null;
  externalItemId?: string | null;
};

/** Розширені поля рядка — у `metadataJson` (поряд із breakdown тощо). */
export type EstimateLineWorkspaceMeta = {
  v?: number;
  description?: string | null;
  material?: string | null;
  facade?: string | null;
  hardware?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  depthMm?: number | null;
  areaM2?: number | null;
  lengthM?: number | null;
  baseCost?: number | null;
  materialCost?: number | null;
  hardwareCost?: number | null;
  workCost?: number | null;
  additionalCost?: number | null;
  discountLine?: number | null;
  marginPct?: number | null;
  calculationMode?: CalculationMode | null;
  /** Доменний режим ціни (v2 metadata); має пріоритет над calculationMode. */
  pricingMode?: string | null;
  formulaLabel?: string | null;
  formulaPreview?: string | null;
  supplier?: SupplierRefMeta | null;
  rowTag?: string | null;
  commercialTags?: string[];
  /** Опційно: видимість рядка у комерційній пропозиції. */
  clientVisible?: boolean;
  pricingSource?: string | null;
  pricingConfidence?: "approximate" | "confirmed" | "stale" | null;
  lastPriceUpdateAt?: string | null;
  marginWarning?: string | null;
  recommendedMarkup?: number | null;
  isManualOverride?: boolean;
  manualOverrideReason?: string | null;
  productionNote?: string | null;
  purchaseNote?: string | null;
  supplierName?: string | null;
  supplierSku?: string | null;
  priceHistoryHint?: string | null;
  riskFlag?: "info" | "warning" | "critical" | null;
  estimateViewHints?: Record<string, unknown> | null;
  /** Для порівняння версій / lineage */
  baseItemId?: string | null;
};

export type EstimateWorkspaceSettings = {
  /** Додаткова націнка % до суми після рядків (до глобальної знижки). */
  extraMarginPct?: number;
  vatMode?: "none" | "included" | "on_top";
  vatRate?: number;
  rounding?: "none" | "1" | "10" | "100";
  paymentTermsPreview?: string;
  /** Приховати внутрішню собівартість у майбутньому експорті КП */
  hideInternalCostsInQuote?: boolean;
  /** Нотатки до секцій за id */
  sectionNotes?: Record<string, string>;
  /** Улюблені коди матеріалів для picker */
  favoriteSupplierCodes?: string[];
  recentSupplierSearches?: string[];
};

export const LINE_TYPE_LABELS: Record<EstimateLineType, string> = {
  PRODUCT: "Продукт",
  MATERIAL: "Матеріал",
  FITTING: "Фурнітура",
  SERVICE: "Послуга",
  DELIVERY: "Доставка",
  INSTALLATION: "Монтаж",
  DISCOUNT: "Знижка",
  WORK: "Роботи",
  OTHER: "Інше",
};

export const UKR_PRODUCT_QUICK_TEMPLATES: { label: string; type: EstimateLineType; name: string }[] = [
  { label: "Кухня", type: "PRODUCT", name: "Кухня (модулі)" },
  { label: "Шафа", type: "PRODUCT", name: "Шафа в нішу" },
  { label: "Гардеробна", type: "PRODUCT", name: "Гардеробна система" },
  { label: "Тумба", type: "PRODUCT", name: "Тумба" },
  { label: "Комод", type: "PRODUCT", name: "Комод" },
  { label: "Пенал", type: "PRODUCT", name: "Пенал" },
  { label: "Антресоль", type: "PRODUCT", name: "Антресоль" },
];
