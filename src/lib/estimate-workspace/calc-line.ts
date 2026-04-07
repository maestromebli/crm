import type { EstimateLineType } from "@prisma/client";
import type { CalculationMode } from "./types";
import type { EstimateLineWorkspaceMeta } from "./types";

export function computeAmountSale(args: {
  qty: number;
  salePrice: number;
  mode: CalculationMode | null | undefined;
  meta: EstimateLineWorkspaceMeta;
  type: EstimateLineType;
}): { salePrice: number; amountSale: number } {
  const { qty, mode, meta, type } = args;
  let salePrice = args.salePrice;

  if (!mode || mode === "manual" || mode === "by_qty") {
    return { salePrice, amountSale: qty * salePrice };
  }

  if (mode === "by_area") {
    const w = (meta.widthMm ?? 0) / 1000;
    const h = (meta.heightMm ?? 0) / 1000;
    const area = meta.areaM2 ?? (w > 0 && h > 0 ? w * h : 0);
    const amountSale = area * salePrice * qty;
    return { salePrice, amountSale };
  }

  if (mode === "running_meter") {
    const len = meta.lengthM ?? (meta.widthMm ? meta.widthMm / 1000 : 0);
    const amountSale = len * salePrice * qty;
    return { salePrice, amountSale };
  }

  if (mode === "module") {
    return { salePrice, amountSale: qty * salePrice };
  }

  if (mode === "custom_formula") {
    return { salePrice, amountSale: qty * salePrice };
  }

  if (type === "DISCOUNT") {
    const amountSale = -Math.abs(qty * salePrice);
    return { salePrice, amountSale };
  }

  return { salePrice, amountSale: qty * salePrice };
}
