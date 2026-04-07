/**
 * Додає в розрахунок блок меблів з детальною таблицею (зони Excel-КП).
 */
import type { EstimateLineType } from "@prisma/client";
import {
  buildFurnitureSheetLinesForDb,
  getTemplateTitle,
  sheetTemplateKeyFromBlockKind,
  type FurnitureTemplateKey as SheetTemplateKey,
} from "../../../lib/estimates/kitchen-cost-sheet-template";
import type { FurnitureTemplateKey as BlockKind } from "../../../lib/estimates/furniture-estimate-templates";
import type { EstimateLineDraft, LineType } from "./estimate-line-draft";

const BLOCK_ICONS: Partial<Record<BlockKind, string>> = {
  kitchen: "🍳",
  kitchen_island: "🏝️",
  wardrobe: "🚪",
  bathroom: "🛁",
  living: "🛋️",
  hallway: "🚶",
  office: "💼",
  children: "🧸",
};

export function iconForBlockKind(kind: BlockKind): string {
  return BLOCK_ICONS[kind] ?? "📦";
}

/** Унікальна назва таблиці при повторному додаванні того ж типу блоку. */
export function nextBlockLabel(
  templateLabel: string,
  kind: BlockKind,
  existing: Pick<EstimateLineDraft, "furnitureBlockKind">[],
): string {
  const perBlock = buildFurnitureSheetLinesForDb(
    sheetTemplateKeyFromBlockKind(kind),
  ).length;
  const n = existing.filter((r) => r.furnitureBlockKind === kind).length;
  const nextIdx = perBlock > 0 ? Math.floor(n / perBlock) + 1 : 1;
  if (nextIdx <= 1) return templateLabel;
  return `${templateLabel} #${nextIdx}`;
}

function prismaTypeToLineType(t: EstimateLineType): LineType {
  if (t === "DELIVERY") return "DELIVERY";
  if (t === "INSTALLATION") return "INSTALLATION";
  if (t === "SERVICE") return "SERVICE";
  return "PRODUCT";
}

function kitchenDbRowToDraft(
  row: ReturnType<typeof buildFurnitureSheetLinesForDb>[number],
  id: string,
  blockKind: BlockKind,
  tableTitle: string | undefined,
): EstimateLineDraft {
  const meta = row.metadataJson;
  return {
    id,
    type: prismaTypeToLineType(row.type),
    category: row.category,
    productName: row.productName,
    qty: row.qty,
    unit: row.unit,
    salePrice: row.salePrice,
    costPrice: row.costPrice,
    amountSale: row.amountSale,
    amountCost: row.amountCost,
    coefficient: meta.coefficient,
    kitchenRole: meta.kitchenRole,
    ...(meta.rowStyle ? { rowStyle: meta.rowStyle } : {}),
    groupId: meta.groupId,
    groupLabel: meta.groupLabel,
    groupIcon: meta.groupIcon,
    templateKey: meta.templateKey as SheetTemplateKey,
    furnitureBlockKind: blockKind,
    ...(tableTitle?.trim()
      ? { tableTitle: tableTitle.trim().slice(0, 200) }
      : {}),
  };
}

export function seedRowsForFurnitureBlock(
  kind: BlockKind,
  opts: {
    blockLabel: string;
    newId: () => string;
  },
): EstimateLineDraft[] {
  const sheetKey = sheetTemplateKeyFromBlockKind(kind);
  const dbLines = buildFurnitureSheetLinesForDb(sheetKey);
  const title =
    opts.blockLabel.trim() ||
    getTemplateTitle(sheetKey);
  return dbLines.map((row) =>
    kitchenDbRowToDraft(row, opts.newId(), kind, title),
  );
}

export type { FurnitureTemplateKey as FurnitureBlockKind } from "../../../lib/estimates/furniture-estimate-templates";
