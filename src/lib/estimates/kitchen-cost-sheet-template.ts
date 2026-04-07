import type { EstimateLineType } from "@prisma/client";
import {
  isFurnitureTemplateKey,
  type FurnitureTemplateKey as FurnitureBlockKind,
} from "./furniture-estimate-templates";

export type { FurnitureBlockKind };

export type FurnitureTemplateKey =
  | "kitchen_no_countertop"
  | "kitchen_island"
  | "wardrobe"
  | "bathroom"
  | "living"
  | "hallway"
  | "office"
  | "children";

export const KITCHEN_NO_COUNTER_TEMPLATE_KEY =
  "kitchen_no_countertop" as const;

export const KITCHEN_CLIENT_PRICE_MULTIPLIER = 2.1;
export const KITCHEN_MARKUP_PERCENT_LABEL = 110;

export type KitchenLineRole = "material" | "measurement";

export type KitchenSheetMetadata = {
  kitchenSheet: true;
  templateKey: FurnitureTemplateKey;
  /** Тип меблевого блоку (кнопки «Додати блок») — окремі таблиці в розрахунку */
  furnitureBlockKind?: FurnitureBlockKind;
  groupId: string;
  groupLabel: string;
  groupIcon: string;
  kitchenRole: KitchenLineRole;
  coefficient: number;
  rowStyle?: "tan" | "orange";
  /** Користувацька назва всієї таблиці (перекриває шаблон за типом блоку) */
  tableTitle?: string;
};

type TemplateRow = {
  groupId: string;
  productName: string;
  qty: number;
  coefficient: number;
  unit: string;
  unitPrice: number;
  type: EstimateLineType;
  role: KitchenLineRole;
  rowStyle?: "tan" | "orange";
};

type FurnitureGroup = { id: string; label: string; icon: string };

type TemplateMeta = {
  title: string;
  keywords: string[];
  groups: FurnitureGroup[];
  rows: TemplateRow[];
};

const TEMPLATE_META: Record<FurnitureTemplateKey, TemplateMeta> = {
  kitchen_no_countertop: {
    title: "Кухня без стільниці",
    keywords: ["кухня", "kitchen"],
    groups: [
      { id: "boards", label: "Плитні матеріали", icon: "🪵" },
      { id: "facades", label: "Фасади та профілі", icon: "🚪" },
      { id: "hardware", label: "Фурнітура", icon: "⚙️" },
      { id: "services", label: "Сервіс", icon: "🛠️" },
    ],
    rows: [
      { groupId: "boards", productName: "ДСП Kronospan K 086 PW Гікорі Рокфорд натуральний", qty: 4, coefficient: 1.3, unit: "лист", unitPrice: 3050, type: "PRODUCT", role: "material" },
      { groupId: "boards", productName: "ДСП лам. Swiss Krono U570 VL Білий Фарфор", qty: 7, coefficient: 1.3, unit: "лист", unitPrice: 3000, type: "PRODUCT", role: "material" },
      { groupId: "boards", productName: "ЛХДФ 3мм лист", qty: 4, coefficient: 1, unit: "лист", unitPrice: 1150, type: "PRODUCT", role: "material" },
      { groupId: "boards", productName: "МДФ", qty: 11, coefficient: 1, unit: "лист", unitPrice: 3200, type: "PRODUCT", role: "material" },
      { groupId: "facades", productName: "Ручка Гола", qty: 6, coefficient: 1, unit: "шт", unitPrice: 600, type: "PRODUCT", role: "material" },
      { groupId: "facades", productName: "Ручка Гола верх", qty: 4, coefficient: 1, unit: "шт", unitPrice: 400, type: "PRODUCT", role: "material" },
      { groupId: "hardware", productName: "Тандеми повні", qty: 7, coefficient: 1, unit: "компл", unitPrice: 1500, type: "PRODUCT", role: "material", rowStyle: "tan" },
      { groupId: "hardware", productName: "Сушка", qty: 1, coefficient: 1, unit: "компл", unitPrice: 2000, type: "PRODUCT", role: "material", rowStyle: "tan" },
      { groupId: "hardware", productName: "Петли Блюм з доводчиком", qty: 18, coefficient: 1, unit: "шт", unitPrice: 120, type: "PRODUCT", role: "material" },
      { groupId: "services", productName: "Расходники (клей, метизи…)", qty: 1, coefficient: 1, unit: "компл", unitPrice: 5000, type: "PRODUCT", role: "material" },
      { groupId: "services", productName: "Товарно-транспортные расходы", qty: 1, coefficient: 1, unit: "компл", unitPrice: 5000, type: "PRODUCT", role: "material" },
      { groupId: "services", productName: "Замер", qty: 1, coefficient: 1, unit: "компл", unitPrice: 1500, type: "SERVICE", role: "measurement", rowStyle: "orange" },
    ],
  },
  kitchen_island: {
    title: "Кухня з островом",
    keywords: ["острів", "island"],
    groups: [
      { id: "kitchen", label: "Кухонний блок", icon: "🍳" },
      { id: "island", label: "Острів", icon: "🏝️" },
      { id: "hardware", label: "Фурнітура", icon: "⚙️" },
      { id: "services", label: "Сервіс", icon: "🛠️" },
    ],
    rows: [
      { groupId: "kitchen", productName: "Корпус нижніх модулів", qty: 1, coefficient: 1, unit: "компл", unitPrice: 38000, type: "PRODUCT", role: "material" },
      { groupId: "island", productName: "Острів: корпус + фасади", qty: 1, coefficient: 1, unit: "компл", unitPrice: 32000, type: "PRODUCT", role: "material" },
      { groupId: "hardware", productName: "Фурнітура Blum / Hettich", qty: 1, coefficient: 1, unit: "компл", unitPrice: 14000, type: "PRODUCT", role: "material" },
      { groupId: "services", productName: "Замер", qty: 1, coefficient: 1, unit: "компл", unitPrice: 1800, type: "SERVICE", role: "measurement", rowStyle: "orange" },
    ],
  },
  wardrobe: {
    title: "Шафа / гардероб",
    keywords: ["шафа", "гардероб", "wardrobe", "closet"],
    groups: [
      { id: "body", label: "Корпус", icon: "🧱" },
      { id: "doors", label: "Фасади", icon: "🚪" },
      { id: "fill", label: "Наповнення", icon: "🗄️" },
      { id: "services", label: "Сервіс", icon: "🛠️" },
    ],
    rows: [
      { groupId: "body", productName: "Корпус ДСП", qty: 1, coefficient: 1, unit: "компл", unitPrice: 26000, type: "PRODUCT", role: "material" },
      { groupId: "doors", productName: "Фасади / дзеркало", qty: 1, coefficient: 1, unit: "компл", unitPrice: 22000, type: "PRODUCT", role: "material" },
      { groupId: "fill", productName: "Штанги, полиці, ящики", qty: 1, coefficient: 1, unit: "компл", unitPrice: 9000, type: "PRODUCT", role: "material" },
      { groupId: "services", productName: "Замер", qty: 1, coefficient: 1, unit: "компл", unitPrice: 1200, type: "SERVICE", role: "measurement", rowStyle: "orange" },
    ],
  },
  bathroom: { title: "Санвузол", keywords: ["санвуз", "ванн", "bathroom"], groups: [{ id: "cab", label: "Тумби", icon: "🚿" }, { id: "mirrors", label: "Дзеркала", icon: "🪞" }, { id: "hardware", label: "Фурнітура", icon: "⚙️" }, { id: "services", label: "Сервіс", icon: "🛠️" }], rows: [{ groupId: "cab", productName: "Тумба під умивальник", qty: 1, coefficient: 1, unit: "шт", unitPrice: 13500, type: "PRODUCT", role: "material" }, { groupId: "mirrors", productName: "Дзеркальна шафа", qty: 1, coefficient: 1, unit: "шт", unitPrice: 8500, type: "PRODUCT", role: "material" }, { groupId: "hardware", productName: "Петлі/напрямні", qty: 1, coefficient: 1, unit: "компл", unitPrice: 2800, type: "PRODUCT", role: "material" }, { groupId: "services", productName: "Замер", qty: 1, coefficient: 1, unit: "компл", unitPrice: 900, type: "SERVICE", role: "measurement", rowStyle: "orange" }] },
  living: { title: "Вітальня / ТВ-зона", keywords: ["віталь", "тв", "living"], groups: [{ id: "tv", label: "ТВ-зона", icon: "📺" }, { id: "shelves", label: "Полиці", icon: "🧰" }, { id: "hardware", label: "Фурнітура", icon: "⚙️" }, { id: "services", label: "Сервіс", icon: "🛠️" }], rows: [{ groupId: "tv", productName: "ТВ-тумба", qty: 1, coefficient: 1, unit: "шт", unitPrice: 14500, type: "PRODUCT", role: "material" }, { groupId: "shelves", productName: "Навісні модулі", qty: 1, coefficient: 1, unit: "компл", unitPrice: 11200, type: "PRODUCT", role: "material" }, { groupId: "hardware", productName: "Фурнітура", qty: 1, coefficient: 1, unit: "компл", unitPrice: 3400, type: "PRODUCT", role: "material" }, { groupId: "services", productName: "Замер", qty: 1, coefficient: 1, unit: "компл", unitPrice: 1100, type: "SERVICE", role: "measurement", rowStyle: "orange" }] },
  hallway: { title: "Передпокій", keywords: ["передпок", "коридор", "hallway"], groups: [{ id: "cab", label: "Шафи і тумби", icon: "🚪" }, { id: "mirror", label: "Дзеркало", icon: "🪞" }, { id: "hardware", label: "Фурнітура", icon: "⚙️" }, { id: "services", label: "Сервіс", icon: "🛠️" }], rows: [{ groupId: "cab", productName: "Шафа в нішу", qty: 1, coefficient: 1, unit: "компл", unitPrice: 21500, type: "PRODUCT", role: "material" }, { groupId: "cab", productName: "Тумба для взуття", qty: 1, coefficient: 1, unit: "шт", unitPrice: 6200, type: "PRODUCT", role: "material" }, { groupId: "mirror", productName: "Дзеркало", qty: 1, coefficient: 1, unit: "шт", unitPrice: 2400, type: "PRODUCT", role: "material" }, { groupId: "services", productName: "Замер", qty: 1, coefficient: 1, unit: "компл", unitPrice: 900, type: "SERVICE", role: "measurement", rowStyle: "orange" }] },
  office: { title: "Офіс / кабінет", keywords: ["офіс", "кабінет", "office"], groups: [{ id: "desk", label: "Робоча зона", icon: "💼" }, { id: "storage", label: "Зберігання", icon: "🗂️" }, { id: "hardware", label: "Фурнітура", icon: "⚙️" }, { id: "services", label: "Сервіс", icon: "🛠️" }], rows: [{ groupId: "desk", productName: "Робочий стіл", qty: 1, coefficient: 1, unit: "шт", unitPrice: 17400, type: "PRODUCT", role: "material" }, { groupId: "storage", productName: "Шафа для документів", qty: 1, coefficient: 1, unit: "шт", unitPrice: 12300, type: "PRODUCT", role: "material" }, { groupId: "hardware", productName: "Кабель-канали та фурнітура", qty: 1, coefficient: 1, unit: "компл", unitPrice: 2900, type: "PRODUCT", role: "material" }, { groupId: "services", productName: "Замер", qty: 1, coefficient: 1, unit: "компл", unitPrice: 1200, type: "SERVICE", role: "measurement", rowStyle: "orange" }] },
  children: { title: "Дитяча", keywords: ["дитяч", "children", "kids"], groups: [{ id: "bed", label: "Ліжко", icon: "🛏️" }, { id: "study", label: "Навчальна зона", icon: "📚" }, { id: "storage", label: "Зберігання", icon: "🧸" }, { id: "services", label: "Сервіс", icon: "🛠️" }], rows: [{ groupId: "bed", productName: "Ліжко + каркас", qty: 1, coefficient: 1, unit: "компл", unitPrice: 16200, type: "PRODUCT", role: "material" }, { groupId: "study", productName: "Стіл + полиці", qty: 1, coefficient: 1, unit: "компл", unitPrice: 9800, type: "PRODUCT", role: "material" }, { groupId: "storage", productName: "Шафа дитяча", qty: 1, coefficient: 1, unit: "шт", unitPrice: 12900, type: "PRODUCT", role: "material" }, { groupId: "services", productName: "Замер", qty: 1, coefficient: 1, unit: "компл", unitPrice: 900, type: "SERVICE", role: "measurement", rowStyle: "orange" }] },
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export const KITCHEN_SHEET_ROWS = TEMPLATE_META.kitchen_no_countertop.rows;

export const FURNITURE_TEMPLATE_KEYS = Object.keys(
  TEMPLATE_META,
) as FurnitureTemplateKey[];

export function detectTemplateKeyByEstimateName(
  name: string | null | undefined,
): FurnitureTemplateKey {
  const text = (name ?? "").trim().toLowerCase();
  if (!text) return KITCHEN_NO_COUNTER_TEMPLATE_KEY;
  for (const key of FURNITURE_TEMPLATE_KEYS) {
    if (TEMPLATE_META[key].keywords.some((kw) => text.includes(kw))) {
      return key;
    }
  }
  return KITCHEN_NO_COUNTER_TEMPLATE_KEY;
}

export function getTemplateTitle(templateKey: FurnitureTemplateKey): string {
  return TEMPLATE_META[templateKey].title;
}

export function kitchenMetadata(
  templateKey: FurnitureTemplateKey,
  row: TemplateRow,
): KitchenSheetMetadata {
  const group =
    TEMPLATE_META[templateKey].groups.find((g) => g.id === row.groupId) ??
    TEMPLATE_META[templateKey].groups[0];
  return {
    kitchenSheet: true,
    templateKey,
    groupId: group.id,
    groupLabel: group.label,
    groupIcon: group.icon,
    kitchenRole: row.role,
    coefficient: row.coefficient,
    ...(row.rowStyle ? { rowStyle: row.rowStyle } : {}),
  };
}

/** Для збереження в metadataJson разом із kitchenSheet */
export function withFurnitureBlockKind(
  meta: KitchenSheetMetadata,
  kind: FurnitureBlockKind | null | undefined,
): KitchenSheetMetadata {
  if (!kind) return meta;
  return { ...meta, furnitureBlockKind: kind };
}

export type KitchenLineForDb = {
  type: EstimateLineType;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  costPrice: null;
  amountSale: number;
  amountCost: null;
  margin: null;
  metadataJson: KitchenSheetMetadata;
};

export function buildFurnitureSheetLinesForDb(
  templateKey: FurnitureTemplateKey,
): KitchenLineForDb[] {
  return TEMPLATE_META[templateKey].rows.map((row) => {
    const amountSale = roundMoney(row.qty * row.coefficient * row.unitPrice);
    return {
      type: row.type,
      category: TEMPLATE_META[templateKey].title,
      productName: row.productName,
      qty: row.qty,
      unit: row.unit,
      salePrice: row.unitPrice,
      costPrice: null,
      amountSale,
      amountCost: null,
      margin: null,
      metadataJson: kitchenMetadata(templateKey, row),
    };
  });
}

export function buildKitchenSheetLinesForDb(): KitchenLineForDb[] {
  return buildFurnitureSheetLinesForDb(KITCHEN_NO_COUNTER_TEMPLATE_KEY);
}

export function sumMaterialRowsFromKitchenLines(
  lines: Array<{ amountSale: number; metadataJson?: unknown }>,
): { material: number; measurement: number } {
  let material = 0;
  let measurement = 0;
  for (const l of lines) {
    const role = parseKitchenRole(l.metadataJson);
    if (role === "measurement") measurement += l.amountSale;
    else material += l.amountSale;
  }
  return { material, measurement };
}

export function sumKitchenDraftLines(
  lines: Array<{ amountSale: number; kitchenRole?: KitchenLineRole }>,
): { material: number; measurement: number } {
  let material = 0;
  let measurement = 0;
  for (const l of lines) {
    if ((l.kitchenRole ?? "material") === "measurement") {
      measurement += l.amountSale;
    } else {
      material += l.amountSale;
    }
  }
  return { material, measurement };
}

export function parseKitchenRole(
  metadataJson: unknown,
): KitchenLineRole | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const r = (metadataJson as { kitchenRole?: unknown }).kitchenRole;
  if (r === "material" || r === "measurement") return r;
  return (metadataJson as { kitchenSheet?: unknown }).kitchenSheet === true
    ? "material"
    : null;
}

export function isKitchenSheetLine(metadataJson: unknown): boolean {
  if (!metadataJson || typeof metadataJson !== "object") return false;
  return (metadataJson as { kitchenSheet?: unknown }).kitchenSheet === true;
}

/**
 * Рядок меблевої розрахункової таблиці (з зонами в Excel-стилі).
 * Для КП та підсумків: без прапорця kitchenSheet у JSON (legacy) лишаються groupId + kitchenRole.
 */
export function isFurnitureCostSheetLine(metadataJson: unknown): boolean {
  if (isKitchenSheetLine(metadataJson)) return true;
  if (!metadataJson || typeof metadataJson !== "object") return false;
  const m = metadataJson as Record<string, unknown>;
  if (
    typeof m.furnitureBlockKind === "string" &&
    isFurnitureTemplateKey(m.furnitureBlockKind)
  ) {
    return true;
  }
  const kr = m.kitchenRole;
  if (
    (kr === "material" || kr === "measurement") &&
    typeof m.groupId === "string" &&
    m.groupId.trim().length > 0
  ) {
    return true;
  }
  return false;
}

export function isKitchenSheetEstimate(
  lines: Array<{ metadataJson?: unknown }>,
): boolean {
  return lines.some((l) => isFurnitureCostSheetLine(l.metadataJson));
}
