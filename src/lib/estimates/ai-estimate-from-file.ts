import { extractFirstJsonObject } from "../ai/extract-json";
import {
  ESTIMATE_CATEGORY_KEYS,
  type EstimateCategoryKey,
  encodeCategoryKey,
  lineTypeForCategory,
} from "./estimate-categories";
import type { AiEstimateDraftResult, DraftLine } from "./ai-estimate-draft";
import { parseEstimatePromptToDraft } from "./ai-estimate-draft";
import { enrichDraftPricingFromText } from "./estimate-draft-pricing-enrich";

function pricingContextText(args: {
  fileName: string;
  extractedText: string | null;
}): string {
  return [args.extractedText?.trim() ?? "", `Ім'я файлу: ${args.fileName}`]
    .filter(Boolean)
    .join("\n\n");
}

function finalizeDraftResult(
  draft: AiEstimateDraftResult,
  pricingContext: string,
): AiEstimateDraftResult {
  const { lines, extraAssumptions } = enrichDraftPricingFromText(
    draft.lines,
    pricingContext,
  );
  return {
    ...draft,
    lines,
    assumptions: [...draft.assumptions, ...extraAssumptions],
  };
}

function isCategoryKey(k: string): k is EstimateCategoryKey {
  return (ESTIMATE_CATEGORY_KEYS as readonly string[]).includes(k);
}

type RawLine = {
  categoryKey?: string;
  productName?: string;
  qty?: number;
  unit?: string;
  salePrice?: number;
};

type AiFileJson = {
  isProjectDocument?: boolean;
  projectKind?: string | null;
  templateKey?: string | null;
  summary?: string;
  lines?: RawLine[];
  confidence?: string;
};

function normalizeDraftFromAi(j: AiFileJson): DraftLine[] {
  const lines: DraftLine[] = [];
  for (const raw of j.lines ?? []) {
    const name =
      typeof raw.productName === "string" ? raw.productName.trim() : "";
    if (!name) continue;
    const ck: EstimateCategoryKey = isCategoryKey(String(raw.categoryKey))
      ? (raw.categoryKey as EstimateCategoryKey)
      : "extras";
    const qty =
      typeof raw.qty === "number" && Number.isFinite(raw.qty) ? raw.qty : 1;
    const unit =
      typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : "шт";
    const salePrice =
      typeof raw.salePrice === "number" && Number.isFinite(raw.salePrice)
        ? Math.max(0, raw.salePrice)
        : 0;
    const amountSale = qty * salePrice;
    lines.push({
      type: lineTypeForCategory(ck),
      category: encodeCategoryKey(ck),
      categoryKey: ck,
      productName: name,
      qty,
      unit,
      salePrice,
      amountSale,
    });
  }
  return lines;
}

export async function analyzeEstimateFromContent(args: {
  fileName: string;
  extractedText: string | null;
  imageBase64: string | null;
  imageMime: string | null;
}): Promise<{
  configured: boolean;
  result: AiEstimateDraftResult;
  isProjectDocument: boolean;
  templateKey: string | null;
  aiSummary: string | null;
  confidence: string | null;
}> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";

  const fallbackText = pricingContextText(args);

  if (!apiKey) {
    const heuristic = parseEstimatePromptToDraft(fallbackText);
    return {
      configured: false,
      result: finalizeDraftResult(heuristic, fallbackText),
      isProjectDocument: heuristic.lines.length > 0,
      templateKey: null,
      aiSummary: "ШІ не налаштовано (AI_API_KEY) — використано локальні евристики.",
      confidence: "low",
    };
  }

  const system = `Ти експерт з комерційних прорахунків корпусних меблів (Україна).
Проаналізуй вміст файлу. Визнач, чи це ТЗ / креслення / специфікація / комерційна пропозиція / опис проєкту (кухня, шафа, офіс тощо).

Поверни ЛИШЕ один JSON-об'єкт (без markdown), формат:
{
  "isProjectDocument": boolean,
  "projectKind": "kitchen" | "wardrobe" | "office" | "other" | null,
  "templateKey": "kitchen" | "wardrobe" | null,
  "summary": "коротко українською що за проєкт",
  "confidence": "high" | "medium" | "low",
  "lines": [
    {
      "categoryKey": одне з: ${ESTIMATE_CATEGORY_KEYS.join(", ")},
      "productName": "назва позиції українською",
      "qty": число,
      "unit": "шт" | "пог. м" | "м²" | "компл" | "рейс",
      "salePrice": число (ціна за одиницю; якщо в документі немає — 0)
    }
  ]
}

Правила:
- Якщо це НЕ проєкт меблів (договір, паспорт, випадковий файл) — isProjectDocument: false, lines: [].
- Якщо проєкт — заповни lines з логічними позиціями (корпус, фасади, фурнітура, доставка, монтаж тощо).
- Якщо в тексті або таблиці є ціни (грн, UAH, ₴) — перенеси їх у salePrice та qty. Якщо цін у документі немає — став salePrice: 0; система підставить орієнтовні значення. Не вигадуй конкретні суми як «факт», якщо їх немає в тексті.
- categoryKey строго зі списку.`;

  const userParts: Array<
    | { type: "text"; text: string }
    | {
        type: "image_url";
        image_url: { url: string; detail?: "low" | "high" };
      }
  > = [];

  if (args.imageBase64 && args.imageMime?.startsWith("image/")) {
    userParts.push({
      type: "text",
      text: `Файл: ${args.fileName}\nОпиши проєкт і позиції з зображення (креслення, фото, скрін).`,
    });
    userParts.push({
      type: "image_url",
      image_url: {
        url: `data:${args.imageMime};base64,${args.imageBase64}`,
        detail: "high",
      },
    });
  } else {
    userParts.push({
      type: "text",
      text: `Файл: ${args.fileName}\n\nТекст з документа:\n${args.extractedText && args.extractedText.trim().length > 0 ? args.extractedText.slice(0, 24000) : "(текст порожній або не витягнуто — покладись на ім'я файлу й контекст)"}`,
    });
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
     
    console.error("[ai-estimate-from-file]", res.status, errText.slice(0, 500));
    const heuristic = parseEstimatePromptToDraft(fallbackText);
    return {
      configured: true,
      result: finalizeDraftResult(heuristic, fallbackText),
      isProjectDocument: heuristic.lines.length > 0,
      templateKey: null,
      aiSummary: `Модель недоступна (${res.status}). Показано евристичну чернетку.`,
      confidence: "low",
    };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  let parsed: AiFileJson;
  try {
    parsed = extractFirstJsonObject(raw) as AiFileJson;
  } catch {
    const heuristic = parseEstimatePromptToDraft(fallbackText);
    return {
      configured: true,
      result: finalizeDraftResult(heuristic, fallbackText),
      isProjectDocument: heuristic.lines.length > 0,
      templateKey: null,
      aiSummary: "Не вдалося розпарсити відповідь ШІ — евристика.",
      confidence: "low",
    };
  }

  const lines = normalizeDraftFromAi(parsed);
  const assumptions: string[] = [];
  if (parsed.summary?.trim()) assumptions.push(parsed.summary.trim());
  if (parsed.projectKind) assumptions.push(`Тип: ${parsed.projectKind}`);
  const missing: string[] = [];
  if (!parsed.isProjectDocument) {
    missing.push("документ не розпізнано як проєкт меблів");
  }

  const result: AiEstimateDraftResult = finalizeDraftResult(
    {
      lines,
      assumptions,
      missing,
    },
    pricingContextText(args),
  );

  return {
    configured: true,
    result,
    isProjectDocument: Boolean(parsed.isProjectDocument),
    templateKey:
      typeof parsed.templateKey === "string" && parsed.templateKey.trim()
        ? parsed.templateKey.trim().slice(0, 64)
        : null,
    aiSummary: parsed.summary?.trim() ?? null,
    confidence: parsed.confidence ?? null,
  };
}
