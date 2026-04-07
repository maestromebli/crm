import type { EstimateItem, EstimateWarning } from "../types/domain";
import { calculatePreDiscountLineTotal, deriveAreaM2 } from "./calculations";

const MIN_MARGIN_PCT = 8;

export type WarningContext = {
  marginThresholdPct?: number;
  requireSupplierCode?: boolean;
};

export function calculateWarnings(args: {
  estimateId: string;
  sectionsEmpty: boolean;
  itemsEmpty: boolean;
  hasActiveVersion: boolean;
  items: EstimateItem[];
  globalMarginPct: number | null;
  ctx?: WarningContext;
}): EstimateWarning[] {
  const out: EstimateWarning[] = [];
  const { ctx } = args;
  const threshold = ctx?.marginThresholdPct ?? MIN_MARGIN_PCT;

  if (!args.hasActiveVersion) {
    out.push({
      id: "no-active",
      scope: "estimate",
      severity: "warning",
      message: "Немає активної версії розрахунку для КП.",
    });
  }

  if (args.sectionsEmpty) {
    out.push({
      id: "no-sections",
      scope: "estimate",
      severity: "info",
      message: "Додайте хоча б одну секцію (кімната / зона).",
    });
  }

  if (args.itemsEmpty) {
    out.push({
      id: "no-items",
      scope: "estimate",
      severity: "warning",
      message: "Немає позицій у розрахунку.",
    });
  }

  if (
    args.globalMarginPct != null &&
    Number.isFinite(args.globalMarginPct) &&
    args.globalMarginPct < threshold
  ) {
    out.push({
      id: "low-margin-global",
      scope: "estimate",
      severity: "danger",
      message: `Маржа нижче порогу (~${threshold}%). Перевірте ціни та знижки.`,
    });
  }

  for (const item of args.items) {
    const idBase = `${item.id}`;
    if (!item.name.trim()) {
      out.push({
        id: `${idBase}-name`,
        scope: "item",
        itemId: item.id,
        sectionId: item.sectionId ?? undefined,
        severity: "warning",
        message: "Позиція без назви.",
      });
    }
    if (item.quantity <= 0) {
      out.push({
        id: `${idBase}-qty`,
        scope: "item",
        itemId: item.id,
        severity: "warning",
        message: `«${item.name || "Позиція"}»: кількість має бути більше 0.`,
      });
    }
    if (item.pricingMode === "area") {
      const a = item.area ?? deriveAreaM2(item.width, item.height);
      if (a == null || a <= 0) {
        out.push({
          id: `${idBase}-area`,
          scope: "item",
          itemId: item.id,
          severity: "warning",
          message: `«${item.name || "Позиція"}»: для режиму «площа» потрібні ширина та висота (або площа).`,
        });
      }
    }
    if (item.pricingMode === "length" && (item.length == null || item.length <= 0)) {
      out.push({
        id: `${idBase}-len`,
        scope: "item",
        itemId: item.id,
        severity: "warning",
        message: `«${item.name || "Позиція"}»: для погонних метрів вкажіть довжину.`,
      });
    }
    const pre = calculatePreDiscountLineTotal(item);
    if (Math.abs(pre) < 1e-6 && item.itemType !== "custom") {
      out.push({
        id: `${idBase}-price`,
        scope: "item",
        itemId: item.id,
        severity: "info",
        message: `«${item.name || "Позиція"}»: нульова сума до знижки.`,
      });
    }
    if (
      ctx?.requireSupplierCode &&
      !item.supplierCode?.trim() &&
      (item.material || item.supplier)
    ) {
      out.push({
        id: `${idBase}-supplier-code`,
        scope: "item",
        itemId: item.id,
        severity: "info",
        message: `«${item.name || "Позиція"}»: вкажіть код постачальника для обліку.`,
      });
    }
  }

  return out;
}
