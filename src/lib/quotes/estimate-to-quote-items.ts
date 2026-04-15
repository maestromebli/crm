import {
  BREAKDOWN_KIND_LABELS,
  parseEstimateLineBreakdown,
} from "../estimates/estimate-line-breakdown";
import {
  detectTemplateKeyByEstimateName,
  getTemplateTitle,
} from "../estimates/kitchen-cost-sheet-template";
import {
  getFurnitureTemplateMeta,
  isFurnitureTemplateKey,
} from "../estimates/furniture-estimate-templates";
import type { QuoteImage, QuoteItem } from "./quote-types";

function randomId(prefix: string, len = 16): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, len)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export type EstimateLineLike = {
  id: string;
  type: string;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  amountSale: number;
  metadataJson?: unknown;
};

type QuoteMaterialBucket =
  | "dsp"
  | "facades"
  | "hardware"
  | "countertop"
  | "services"
  | "other";

export type QuoteItemBuildOptions = {
  estimateName?: string | null;
  /** З поля Estimate.templateKey — для типової назви таблиці, якщо не в metadata рядка */
  estimateTemplateKey?: string | null;
  /** Режим групування КП: legacy по групах або 1 рядок на тип меблів. */
  groupingMode?: "group" | "furniture_type";
  /** Які блоки матеріалів залишати в descriptionLines. */
  materialBuckets?: QuoteMaterialBucket[];
};

function metaRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object"
    ? (raw as Record<string, unknown>)
    : {};
}

function groupKey(li: EstimateLineLike): string {
  const m = metaRecord(li.metadataJson);
  const gid = m.groupId;
  if (typeof gid === "string" && gid.trim()) return `g:${gid.trim()}`;
  const cat = li.category?.trim();
  if (cat) return `c:${cat}`;
  return "__ungrouped__";
}

function groupKeyByFurnitureType(li: EstimateLineLike): string {
  const m = metaRecord(li.metadataJson);
  const fk = m.furnitureBlockKind;
  if (typeof fk === "string" && isFurnitureTemplateKey(fk)) {
    return `f:${fk}`;
  }
  const tableTitle =
    typeof m.tableTitle === "string" && m.tableTitle.trim()
      ? m.tableTitle.trim()
      : "";
  if (tableTitle) {
    return `t:${tableTitle.toLowerCase()}`;
  }
  const tk = m.templateKey;
  if (typeof tk === "string" && tk.trim()) {
    const detected = detectTemplateKeyByEstimateName(tk);
    if (detected === "kitchen_no_countertop") return "f:kitchen";
    if (isFurnitureTemplateKey(detected)) return `f:${detected}`;
  }
  return groupKey(li);
}

function titleForGroup(
  key: string,
  lines: EstimateLineLike[],
  estimateName?: string | null,
): string {
  if (key.startsWith("f:")) {
    const kind = key.slice(2);
    if (isFurnitureTemplateKey(kind)) {
      const shortByKind: Record<string, string> = {
        kitchen: "Кухня",
        kitchen_island: "Кухня",
        wardrobe: "Шафа",
        bathroom: "Санвузол",
        living: "Вітальня",
        hallway: "Передпокій",
        office: "Кабінет",
        children: "Дитяча",
      };
      return shortByKind[kind] ?? getFurnitureTemplateMeta(kind)?.label ?? kind;
    }
  }
  if (key.startsWith("g:")) {
    const m0 = metaRecord(lines[0]?.metadataJson);
    const gl = m0.groupLabel;
    if (typeof gl === "string" && gl.trim()) return gl.trim();
  }
  if (key.startsWith("t:")) {
    const m0 = metaRecord(lines[0]?.metadataJson);
    const tt = m0.tableTitle;
    if (typeof tt === "string" && tt.trim()) return tt.trim();
  }
  if (key.startsWith("c:")) return key.slice(2);
  if (key === "__ungrouped__") {
    const en = estimateName?.trim();
    if (en) return en;
    return "Позиції за прорахунком";
  }
  return lines[0]?.productName?.trim() || "Позиція";
}

/**
 * Той самий заголовок, що над таблицею в розрахунку (input у KitchenCostSheetTable).
 */
function sheetDisplayTitleForLines(
  lines: EstimateLineLike[],
  estimateName?: string | null,
  estimateTemplateKey?: string | null,
): string | null {
  if (!lines.length) return null;
  const m0 = metaRecord(lines[0].metadataJson);
  const custom =
    typeof m0.tableTitle === "string" && m0.tableTitle.trim()
      ? m0.tableTitle.trim()
      : null;
  if (custom) return custom;

  const sheetKeyFromLine =
    typeof m0.templateKey === "string" && m0.templateKey.trim()
      ? detectTemplateKeyByEstimateName(m0.templateKey)
      : null;
  const sheetKey =
    sheetKeyFromLine ??
    (estimateTemplateKey
      ? detectTemplateKeyByEstimateName(estimateTemplateKey)
      : detectTemplateKeyByEstimateName(estimateName));

  const fkRaw = m0.furnitureBlockKind;
  if (typeof fkRaw === "string" && isFurnitureTemplateKey(fkRaw)) {
    return (
      getFurnitureTemplateMeta(fkRaw)?.label ?? getTemplateTitle(sheetKey)
    );
  }
  return `Інші позиції · ${getTemplateTitle(sheetKey)}`;
}

/** Рядки опису для КП: лише найменування (без кількості та вартості). */
function descriptionLinesForLine(li: EstimateLineLike): string[] {
  const out: string[] = [];
  const meta = parseEstimateLineBreakdown(li.metadataJson);
  if (meta?.components.length) {
    for (const c of meta.components) {
      const kind = BREAKDOWN_KIND_LABELS[c.kind] ?? "Позиція";
      const name = c.name?.trim() ?? "";
      if (name) out.push(`${kind}: ${name}`);
    }
  } else if (li.productName.trim()) {
    out.push(li.productName.trim());
  }
  return out;
}

function classifyLineBucket(li: EstimateLineLike): QuoteMaterialBucket {
  const m = metaRecord(li.metadataJson);
  const gid = typeof m.groupId === "string" ? m.groupId.toLowerCase() : "";
  const gl = typeof m.groupLabel === "string" ? m.groupLabel.toLowerCase() : "";
  const token = `${li.type} ${li.category ?? ""} ${li.productName} ${gid} ${gl}`.toLowerCase();
  if (/(service|delivery|installation|замір|монтаж|доставк|сервіс)/.test(token)) {
    return "services";
  }
  if (/(counter|стільниц|столеш)/.test(token)) return "countertop";
  if (/(fitting|hardware|фурнітур|blum|hettich|петл|напрям)/.test(token)) {
    return "hardware";
  }
  if (/(facade|door|фасад)/.test(token)) return "facades";
  if (/(dsp|дсп|мдф|корпус|body|boards|cab)/.test(token)) return "dsp";
  return "other";
}

function dedupeLinesPreserveOrder(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/**
 * Групує рядки смети в позиції КП (зона / група / виріб).
 * Матеріали лишаються всередині descriptionLines.
 */
export function estimateLinesToQuoteItems(
  lines: EstimateLineLike[],
  options?: QuoteItemBuildOptions,
): QuoteItem[] {
  const materialBuckets =
    options?.materialBuckets && options.materialBuckets.length > 0
      ? new Set(options.materialBuckets)
      : null;
  const groupingMode = options?.groupingMode ?? "group";
  const groups = new Map<string, EstimateLineLike[]>();
  const order: string[] = [];

  for (const li of lines) {
    const k =
      groupingMode === "furniture_type"
        ? groupKeyByFurnitureType(li)
        : groupKey(li);
    if (!groups.has(k)) {
      groups.set(k, []);
      order.push(k);
    }
    groups.get(k)!.push(li);
  }

  let sortOrder = 0;
  const items: QuoteItem[] = [];

  for (const key of order) {
    const block = groups.get(key) ?? [];
    if (!block.length) continue;

    const groupTitle = titleForGroup(key, block, options?.estimateName);
    const sheetTitle = sheetDisplayTitleForLines(
      block,
      options?.estimateName,
      options?.estimateTemplateKey,
    );
    const title = sheetTitle ?? groupTitle;
    let lineTotal = 0;
    for (const li of block) {
      lineTotal += Number.isFinite(li.amountSale) ? li.amountSale : 0;
    }
    lineTotal = Math.round(lineTotal * 100) / 100;

    const desc: string[] = [];
    for (const li of block) {
      if (materialBuckets && !materialBuckets.has(classifyLineBucket(li))) {
        continue;
      }
      desc.push(...descriptionLinesForLine(li));
    }
    const descriptionLines = dedupeLinesPreserveOrder(desc);

    const qty = 1;
    const item: QuoteItem = {
      id: randomId("qi"),
      sortOrder: sortOrder++,
      title,
      quantity: qty,
      totalPrice: lineTotal,
      descriptionLines,
      images: [],
    };
    items.push(item);
  }

  return items;
}

export function newQuoteImage(url: string, sortOrder: number): QuoteImage {
  return {
    id: randomId("img", 12),
    url: url.trim(),
    sortOrder,
  };
}
