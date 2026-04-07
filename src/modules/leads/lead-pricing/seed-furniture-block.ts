/**
 * Додає в один розрахунок окремий блок типу меблів (кухня, шафа, …)
 * з типовими порожніми рядками для подальшого заповнення цін.
 */
import type { DraftLine } from "../../../lib/estimates/ai-estimate-draft";
import {
  getFurnitureTemplateDraftLines,
  type FurnitureTemplateKey as BlockKind,
} from "../../../lib/estimates/furniture-estimate-templates";
import type { FurnitureTemplateKey as SheetTemplateKey } from "../../../lib/estimates/kitchen-cost-sheet-template";
import { getTemplateTitle } from "../../../lib/estimates/kitchen-cost-sheet-template";
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

/** Унікальна назва блоку, якщо вже є блоки з тим самим шаблоном. */
export function nextBlockLabel(
  templateLabel: string,
  existing: Pick<EstimateLineDraft, "groupId" | "groupLabel">[],
): string {
  const byGroup = new Map<string, string>();
  for (const row of existing) {
    if (row.groupId && row.groupLabel) {
      byGroup.set(row.groupId, row.groupLabel);
    }
  }
  let sameTemplateCount = 0;
  for (const label of byGroup.values()) {
    if (label === templateLabel || label.startsWith(`${templateLabel} #`)) {
      sameTemplateCount++;
    }
  }
  if (sameTemplateCount === 0) return templateLabel;
  return `${templateLabel} #${sameTemplateCount + 1}`;
}

function prismaTypeToLineType(t: DraftLine["type"]): LineType {
  if (t === "DELIVERY") return "DELIVERY";
  if (t === "INSTALLATION") return "INSTALLATION";
  if (t === "SERVICE") return "SERVICE";
  return "PRODUCT";
}

function lineToDraft(
  d: DraftLine,
  args: {
    id: string;
    blockGroupId: string;
    blockLabel: string;
    blockIcon: string;
    sheetTemplateKey: SheetTemplateKey;
    blockKind: BlockKind;
  },
): EstimateLineDraft {
  const coefficient = 1;
  const salePrice = d.salePrice ?? 0;
  const qty = d.qty;
  const amountSale =
    Math.round(qty * coefficient * salePrice * 100) / 100;
  const kitchenRole =
    d.type === "SERVICE" ? "measurement" : "material";

  return {
    id: args.id,
    type: prismaTypeToLineType(d.type),
    category: d.category?.trim() || getTemplateTitle(args.sheetTemplateKey),
    productName: d.productName,
    qty,
    unit: d.unit,
    salePrice,
    costPrice: null,
    amountSale,
    amountCost: null,
    coefficient,
    kitchenRole,
    groupId: args.blockGroupId,
    groupLabel: args.blockLabel,
    groupIcon: args.blockIcon,
    templateKey: args.sheetTemplateKey,
    furnitureBlockKind: args.blockKind,
  };
}

export function seedRowsForFurnitureBlock(
  kind: BlockKind,
  opts: {
    blockGroupId: string;
    blockLabel: string;
    blockIcon: string;
    sheetTemplateKey: SheetTemplateKey;
    newId: () => string;
  },
): EstimateLineDraft[] {
  const drafts = getFurnitureTemplateDraftLines(kind);
  return drafts.map((d) =>
    lineToDraft(d, {
      id: opts.newId(),
      blockGroupId: opts.blockGroupId,
      blockLabel: opts.blockLabel,
      blockIcon: opts.blockIcon,
      sheetTemplateKey: opts.sheetTemplateKey,
      blockKind: kind,
    }),
  );
}

export type { FurnitureTemplateKey as FurnitureBlockKind } from "../../../lib/estimates/furniture-estimate-templates";
