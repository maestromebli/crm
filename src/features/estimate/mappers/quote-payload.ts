import type { EstimateItem, QuotePayload } from "../types/domain";
import type { SectionModel } from "./line-domain-mapper";
import { lineModelToEstimateItem } from "./line-domain-mapper";
import type { LineModel } from "./line-domain-mapper";

export type MapQuoteArgs = {
  estimateId: string;
  versionNumber: number;
  versionName: string | null;
  currency: string;
  sections: SectionModel[];
  lines: LineModel[];
  globalDiscountAmount: number;
  deliveryCost: number;
  installationCost: number;
  notes: string | null;
  /** Only include these section ids; if empty, include all */
  sectionIds?: string[];
  includeBreakdown: boolean;
  includeDelivery: boolean;
  includeInstallation: boolean;
};

/**
 * Готує payload для КП / зовнішнього документа без внутрішньої собівартості.
 */
export function mapEstimateToQuotePayload(args: MapQuoteArgs): QuotePayload {
  const sectionFilter =
    args.sectionIds && args.sectionIds.length > 0
      ? new Set(args.sectionIds)
      : null;

  const sectionBlocks = args.sections
    .filter((s) => !sectionFilter || sectionFilter.has(s.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((sec) => {
      const lines = args.lines.filter(
        (l) => l.sectionId === sec.id && (!sectionFilter || sectionFilter.has(sec.id)),
      );
      const items = lines.map((ln) =>
        lineModelToEstimateItem(ln, args.estimateId),
      );
      const publicLines = items.map((item) => toPublicLine(item, sec.title));
      const sectionSubtotal = items.reduce((a, i) => a + i.finalPrice, 0);
      return {
        id: sec.id,
        name: sec.title,
        lines: args.includeBreakdown ? publicLines : [],
        sectionSubtotal,
      };
    });

  let subtotal = sectionBlocks.reduce((a, s) => a + s.sectionSubtotal, 0);
  let delivery = args.includeDelivery ? args.deliveryCost : 0;
  let installation = args.includeInstallation ? args.installationCost : 0;
  const discount = args.globalDiscountAmount;
  const grandTotal = subtotal - discount + delivery + installation;

  return {
    versionId: args.estimateId,
    versionNumber: args.versionNumber,
    versionName: args.versionName,
    currency: args.currency,
    sections: sectionBlocks,
    subtotal,
    discount,
    delivery,
    installation,
    grandTotal,
    notes: args.notes,
    includeBreakdown: args.includeBreakdown,
    generatedAt: new Date().toISOString(),
  };
}

function toPublicLine(item: EstimateItem, sectionName: string) {
  const unitPrice =
    item.quantity > 0 ? item.finalPrice / item.quantity : item.finalPrice;
  return {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: Math.round(unitPrice * 100) / 100,
    lineTotal: Math.round(item.finalPrice * 100) / 100,
    sectionName,
    comment: item.comment,
  };
}
