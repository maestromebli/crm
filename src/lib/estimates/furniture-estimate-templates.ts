/**
 * Шаблони розрахунку меблів (логіка як у типових Excel КП: зони → позиції).
 * Використовуються для старту смети та для підказок ШІ.
 */
import type { EstimateLineType } from "@prisma/client";
import type { DraftLine } from "./ai-estimate-draft";
import type { EstimateCategoryKey } from "./estimate-categories";

export type FurnitureTemplateKey =
  | "kitchen"
  | "kitchen_island"
  | "wardrobe"
  | "bathroom"
  | "living"
  | "hallway"
  | "office"
  | "children";

export type FurnitureTemplateMeta = {
  key: FurnitureTemplateKey;
  label: string;
  /** Короткий опис для UI і для промпту ШІ */
  description: string;
  /** Текст, що додається до внутрішнього контексту ШІ (структура Excel-КП) */
  aiContext: string;
};

export const FURNITURE_TEMPLATES: FurnitureTemplateMeta[] = [
  {
    key: "kitchen",
    label: "Кухня (детальна смета)",
    description:
      "Плитні матеріали, фасади, фурнітура, сервіс — як у Excel-КП; можна додавати свої рядки та міняти коефіцієнти.",
    aiContext: `Структура як у Excel-КП по кухні:
- Зона «Кухня»: корпус нижній (модулі), корпус верхній, фасади (МДФ/плівка/пофарбовані), фурнітура (петлі Blum/Hettich, підйомники, напрямні), стільниця (HPL/акрил/кварц), кромка, цоколь, плінтус, послуги (замір, розкрій, кромкування, доставка, монтаж).
- Додатково зони за потреби: Коридор, Балкон (якщо згадано).
- Кожна позиція — окремий рядок з кількістю та одиницями (шт, м.п., м², компл).`,
  },
  {
    key: "kitchen_island",
    label: "Кухня (з островом)",
    description:
      "Те саме, що й модульна кухня, плюс типові позиції для острова.",
    aiContext: `Як кухня модульна, додатково зона «Кухня»: острів (корпус, фасад, стільниця, фурнітура, електрика/підсвітка за потреби).`,
  },
  {
    key: "wardrobe",
    label: "Шафа / гардероб",
    description:
      "Корпус, наповнення, фасади, фурнітура, дзеркало, підсвітка.",
    aiContext: `Структура КП шафи-купе / гардеробної:
- Зона «Гардероб» або «Спальня»: корпус (ДСП/МДФ), фасади, фурнітура (розсувні системи, ручки, петлі), наповнення (штанги, полиці, тумби), дзеркало, підсвітка, доставка, монтаж.`,
  },
  {
    key: "bathroom",
    label: "Санвузол (меблі)",
    description:
      "Тумба з умивальником, дзеркало/шкаф, шафи, піни, мийка.",
    aiContext: `Структура КП меблів для ванної:
- Зона «Санвузол»: тумба під умивальник, дзеркало/шкаф, шафа/пенал, додаткові модулі, фурнітура, доставка, монтаж.`,
  },
  {
    key: "living",
    label: "Вітальня / ТВ-зона",
    description:
      "Тумби ТВ, стінки, полиці, фасади, фурнітура.",
    aiContext: `Структура КП вітальні:
- Зона «Вітальня»: ТВ-тумба, стінка, навісні полиці, ніші, фасади, фурнітура, доставка, монтаж.`,
  },
  {
    key: "hallway",
    label: "Передпокій",
    description:
      "Шафа в нішу, тумба для взуття, дзеркало, фурнітура.",
    aiContext: `Структура КП передпокою:
- Зона «Коридор»: шафа в нішу, тумба для взуття, вішалка, дзеркало, фурнітура, доставка, монтаж.`,
  },
  {
    key: "office",
    label: "Офіс / кабінет",
    description:
      "Стіл, стелажі, тумби, панелі.",
    aiContext: `Структура КП офісу:
- Зона «Кабінет»: стіл, стелажі, тумби, панелі, фурнітура, доставка, монтаж.`,
  },
  {
    key: "children",
    label: "Дитяча",
    description:
      "Ліжко, шафа, стіл, полиці, безпека фурнітури.",
    aiContext: `Структура КП дитячої:
- Зона «Дитяча»: ліжко, шафа, стіл/полиці, фурнітура з доводчиками, доставка, монтаж.`,
  },
];

const FURNITURE_TEMPLATE_KEYS = new Set<string>(
  FURNITURE_TEMPLATES.map((t) => t.key),
);

/** Перевірка, що ключ з API/форми відповідає відомому шаблону меблів. */
export function isFurnitureTemplateKey(
  key: string,
): key is FurnitureTemplateKey {
  return FURNITURE_TEMPLATE_KEYS.has(key);
}

function seedLine(
  zone: string,
  productName: string,
  categoryKey: EstimateCategoryKey,
  type: EstimateLineType,
  qty: number,
  unit: string,
): DraftLine {
  return {
    type,
    category: zone,
    categoryKey,
    productName,
    qty,
    unit,
    salePrice: 0,
    amountSale: 0,
  };
}

/** Позиції-шаблон (як у типовому Excel: розбиття по зонах і рядках). */
export function getFurnitureTemplateDraftLines(
  key: FurnitureTemplateKey,
): DraftLine[] {
  const L = seedLine;

  switch (key) {
    case "kitchen":
    case "kitchen_island":
      return [
        L("Кухня", "Корпус нижні модулі (ДСП/МДФ)", "cabinets", "PRODUCT", 1, "компл"),
        L("Кухня", "Корпус верхні модулі", "cabinets", "PRODUCT", 1, "компл"),
        L("Кухня", "Фасади (МДФ/плівка/фарбування)", "facades", "PRODUCT", 1, "компл"),
        L("Кухня", "Фурнітура (петлі, підйомники, напрямні)", "fittings", "PRODUCT", 1, "компл"),
        L("Кухня", "Стільниця (HPL/акрил/кварц)", "countertop", "PRODUCT", 1, "п.м."),
        L("Кухня", "Кромка / кромкування", "extras", "PRODUCT", 1, "п.м."),
        L("Кухня", "Цоколь / плінтус кухонний", "extras", "PRODUCT", 1, "п.м."),
        L("Кухня", "Послуги: замір, проєкт, розкрій", "extras", "SERVICE", 1, "компл"),
        ...(key === "kitchen_island"
          ? [
              L(
                "Кухня",
                "Острів: корпус + фасад + стільниця",
                "cabinets",
                "PRODUCT",
                1,
                "компл",
              ),
            ]
          : []),
        L("Кухня", "Доставка", "delivery", "DELIVERY", 1, "рейс"),
        L("Кухня", "Монтаж / збірка", "installation", "INSTALLATION", 1, "компл"),
      ];
    case "wardrobe":
      return [
        L("Гардероб", "Корпус шафи (ДСП/МДФ)", "cabinets", "PRODUCT", 1, "компл"),
        L("Гардероб", "Фасади (фарба/плівка/дзеркало)", "facades", "PRODUCT", 1, "компл"),
        L("Гардероб", "Система розсування / ролики", "fittings", "PRODUCT", 1, "компл"),
        L("Гардероб", "Наповнення (штанги, полиці, ящики)", "extras", "PRODUCT", 1, "компл"),
        L("Гардероб", "Фурнітура (петлі, ручки, доводчики)", "fittings", "PRODUCT", 1, "компл"),
        L("Гардероб", "Підсвітка (за потреби)", "extras", "PRODUCT", 1, "компл"),
        L("Гардероб", "Доставка", "delivery", "DELIVERY", 1, "рейс"),
        L("Гардероб", "Монтаж / збірка", "installation", "INSTALLATION", 1, "компл"),
      ];
    case "bathroom":
      return [
        L("Санвузол", "Тумба під умивальник", "cabinets", "PRODUCT", 1, "шт"),
        L("Санвузол", "Дзеркало / дзеркальна шафа", "facades", "PRODUCT", 1, "шт"),
        L("Санвузол", "Пенал / висока шафа", "cabinets", "PRODUCT", 1, "шт"),
        L("Санвузол", "Фурнітура", "fittings", "PRODUCT", 1, "компл"),
        L("Санвузол", "Доставка", "delivery", "DELIVERY", 1, "рейс"),
        L("Санвузол", "Монтаж", "installation", "INSTALLATION", 1, "компл"),
      ];
    case "living":
      return [
        L("Вітальня", "ТВ-тумба / модуль", "cabinets", "PRODUCT", 1, "компл"),
        L("Вітальня", "Навісні полиці / секції", "cabinets", "PRODUCT", 1, "компл"),
        L("Вітальня", "Фасади", "facades", "PRODUCT", 1, "компл"),
        L("Вітальня", "Фурнітура", "fittings", "PRODUCT", 1, "компл"),
        L("Вітальня", "Доставка", "delivery", "DELIVERY", 1, "рейс"),
        L("Вітальня", "Монтаж", "installation", "INSTALLATION", 1, "компл"),
      ];
    case "hallway":
      return [
        L("Коридор", "Шафа в нішу / корпус", "cabinets", "PRODUCT", 1, "компл"),
        L("Коридор", "Тумба для взуття", "cabinets", "PRODUCT", 1, "шт"),
        L("Коридор", "Вішалка / фурнітура", "fittings", "PRODUCT", 1, "компл"),
        L("Коридор", "Дзеркало", "extras", "PRODUCT", 1, "шт"),
        L("Коридор", "Доставка", "delivery", "DELIVERY", 1, "рейс"),
        L("Коридор", "Монтаж", "installation", "INSTALLATION", 1, "компл"),
      ];
    case "office":
      return [
        L("Кабінет", "Стіл", "cabinets", "PRODUCT", 1, "шт"),
        L("Кабінет", "Стелаж / тумби", "cabinets", "PRODUCT", 1, "компл"),
        L("Кабінет", "Панелі / стінки", "facades", "PRODUCT", 1, "компл"),
        L("Кабінет", "Фурнітура", "fittings", "PRODUCT", 1, "компл"),
        L("Кабінет", "Доставка", "delivery", "DELIVERY", 1, "рейс"),
        L("Кабінет", "Монтаж", "installation", "INSTALLATION", 1, "компл"),
      ];
    case "children":
      return [
        L("Дитяча", "Ліжко / меблі для сну", "cabinets", "PRODUCT", 1, "компл"),
        L("Дитяча", "Шафа / зберігання", "cabinets", "PRODUCT", 1, "компл"),
        L("Дитяча", "Стіл / стіна полиць", "cabinets", "PRODUCT", 1, "компл"),
        L("Дитяча", "Фурнітура (доводчики)", "fittings", "PRODUCT", 1, "компл"),
        L("Дитяча", "Доставка", "delivery", "DELIVERY", 1, "рейс"),
        L("Дитяча", "Монтаж", "installation", "INSTALLATION", 1, "компл"),
      ];
    default:
      return [];
  }
}

export function getFurnitureTemplateMeta(
  key: string | undefined | null,
): FurnitureTemplateMeta | null {
  if (!key) return null;
  return FURNITURE_TEMPLATES.find((t) => t.key === key) ?? null;
}

export function mergeTemplateWithHeuristicDraft(
  template: FurnitureTemplateKey | undefined,
  heuristic: DraftLine[],
): DraftLine[] {
  if (!template) return heuristic;
  const seed = getFurnitureTemplateDraftLines(template);
  if (heuristic.length === 0) return seed;
  const merged = [...seed];
  for (const h of heuristic) {
    const dup = merged.some(
      (m) =>
        m.productName === h.productName &&
        (m.category || "") === (h.category || ""),
    );
    if (!dup) merged.push(h);
  }
  return merged;
}

/** Розширений промпт для ШІ (на майбутній OpenAI-інтеграції). */
export function buildAiPromptWithTemplate(
  userPrompt: string,
  templateKey: FurnitureTemplateKey | undefined,
): string {
  const meta = templateKey ? getFurnitureTemplateMeta(templateKey) : null;
  const parts: string[] = [];
  if (meta) {
    parts.push(`[Тип меблів: ${meta.label}]`);
    parts.push(meta.aiContext);
  }
  if (userPrompt.trim()) {
    parts.push(`[Текст клієнта / менеджера]\n${userPrompt.trim()}`);
  }
  return parts.join("\n\n");
}
