import type { EstimateItem, EstimateSection, EstimateSummary } from "../types/domain";
import type { FormulaConfig } from "../types/domain";

const MM_TO_M = 0.001;

// CORE LOGIC - DO NOT BREAK

export function deriveAreaM2(
  widthMm: number | null,
  heightMm: number | null,
): number | null {
  if (
    widthMm == null ||
    heightMm == null ||
    !Number.isFinite(widthMm) ||
    !Number.isFinite(heightMm) ||
    widthMm <= 0 ||
    heightMm <= 0
  ) {
    return null;
  }
  return widthMm * MM_TO_M * (heightMm * MM_TO_M);
}

export function calculateItemCost(item: EstimateItem): number {
  const parts = [
    item.baseCost ?? 0,
    item.materialCost ?? 0,
    item.hardwareCost ?? 0,
    item.workCost ?? 0,
    item.additionalCost ?? 0,
  ];
  const sum = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return Number.isFinite(sum) ? sum : 0;
}

function pickSourceAmount(
  item: EstimateItem,
  field: NonNullable<FormulaConfig["sourceField"]>,
): number {
  switch (field) {
    case "materialCost":
      return item.materialCost ?? 0;
    case "baseCost":
      return item.baseCost ?? 0;
    case "workCost":
      return item.workCost ?? 0;
    case "unitPrice":
      return item.unitSalePrice;
    case "custom":
    default:
      return item.materialCost ?? item.baseCost ?? 0;
  }
}

export function calculatePreDiscountLineTotal(item: EstimateItem): number {
  const qty = item.quantity > 0 ? item.quantity : 0;
  const p = item.unitSalePrice;

  switch (item.pricingMode) {
    case "manual":
      return item.finalPrice;
    case "quantity":
      return qty * p;
    case "area": {
      const a = item.area ?? deriveAreaM2(item.width, item.height);
      if (a == null || a <= 0) return 0;
      return a * p * qty;
    }
    case "length": {
      const len = item.length ?? 0;
      if (len <= 0) return 0;
      return len * p * qty;
    }
    case "module":
      return qty * p;
    case "formula":
      return applyFormulaSale(item);
    default:
      return qty * p;
  }
}

function applyFormulaSale(item: EstimateItem): number {
  const cfg = item.formulaConfig;
  if (!cfg) return item.quantity * item.unitSalePrice;
  const coeff = cfg.coefficient ?? 1;
  const base = pickSourceAmount(item, cfg.sourceField ?? "materialCost");
  return base * coeff;
}

export function calculateItemDiscount(
  preDiscountSale: number,
  discountType: EstimateItem["discountType"],
  discountValue: number,
): number {
  if (discountValue <= 0 || preDiscountSale <= 0) return 0;
  if (discountType === "fixed") return Math.min(discountValue, preDiscountSale);
  return preDiscountSale * (discountValue / 100);
}

export function calculateItemSaleAfterDiscount(item: EstimateItem): number {
  const pre = calculatePreDiscountLineTotal(item);
  const disc = calculateItemDiscount(pre, item.discountType, item.discountValue);
  return Math.max(0, pre - disc);
}

export function calculateItemMarginAmount(
  saleAfterDiscount: number,
  totalCost: number,
): number {
  return saleAfterDiscount - totalCost;
}

export function recalculateEstimateItem(item: EstimateItem): EstimateItem {
  const area = item.area ?? deriveAreaM2(item.width, item.height);
  const computedCost = calculateItemCost(item);
  const cost =
    computedCost > 0
      ? computedCost
      : item.totalCost > 0
        ? item.totalCost
        : 0;
  const sale = calculateItemSaleAfterDiscount({ ...item, area });
  const marginPct = sale > 0 ? ((sale - cost) / sale) * 100 : null;
  return {
    ...item,
    area,
    totalCost: cost,
    finalPrice: sale,
    marginPercent: marginPct,
  };
}

export function calculateSectionTotals(
  section: EstimateSection,
  items: EstimateItem[],
): EstimateSection {
  const sid = section.id;
  const own = items.filter((i) => i.sectionId === sid);
  const subtotalSale = own.reduce((a, i) => a + i.finalPrice, 0);
  const subtotalCost = own.reduce((a, i) => a + i.totalCost, 0);
  const subtotalDiscount = own.reduce((a, i) => {
    const pre = calculatePreDiscountLineTotal(i);
    return a + calculateItemDiscount(pre, i.discountType, i.discountValue);
  }, 0);
  const subtotalMargin = subtotalSale - subtotalCost;
  return {
    ...section,
    subtotalSale,
    subtotalCost,
    subtotalDiscount,
    subtotalMargin,
  };
}

export function calculateEstimateSummary(args: {
  sections: EstimateSection[];
  items: EstimateItem[];
  globalDiscountAmount: number;
  deliveryCost: number;
  installationCost: number;
  /** Додаткова націнка до суми рядків (1.12 = +12%). */
  lineSaleScale?: number;
}): EstimateSummary {
  const {
    items,
    globalDiscountAmount,
    deliveryCost,
    installationCost,
    lineSaleScale = 1,
  } = args;
  const itemCount = items.length;
  const totalSaleRaw = items.reduce((a, i) => a + i.finalPrice, 0);
  const totalSaleScaled = totalSaleRaw * lineSaleScale;
  const totalCost = items.reduce((a, i) => a + i.totalCost, 0);
  const lineDiscounts = items.reduce((a, i) => {
    const pre = calculatePreDiscountLineTotal(i);
    return a + calculateItemDiscount(pre, i.discountType, i.discountValue);
  }, 0);
  const totalDiscount = lineDiscounts + globalDiscountAmount;
  const grandTotal =
    totalSaleScaled - globalDiscountAmount + deliveryCost + installationCost;
  const totalMargin = grandTotal - totalCost;
  const profitabilityPercent =
    grandTotal > 0 ? (totalMargin / grandTotal) * 100 : 0;
  return {
    totalCost,
    totalSale: totalSaleScaled,
    totalDiscount,
    totalMargin,
    profitabilityPercent,
    sectionCount: args.sections.length,
    itemCount,
    grandTotal,
  };
}
