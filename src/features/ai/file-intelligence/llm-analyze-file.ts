import { extractFirstJsonObject } from "../../../lib/ai/extract-json";
import type { AiDetectedFileCategory } from "@prisma/client";

export type LlmFileAnalysis = {
  detectedCategory: AiDetectedFileCategory;
  shortSummary: string;
  detailedSummary: string;
  probablePurpose: string;
  stageRelevance: string;
  confidenceScore: number;
  extractedEntities: Record<string, unknown>;
  extractedMeasurements: unknown[];
  extractedAmounts: unknown[];
  extractedDates: unknown[];
  extractedPeople: unknown[];
  extractedMaterials: unknown[];
  extractedRisks: unknown[];
  suggestedActions: string[];
};

const CATEGORY_KEYS: AiDetectedFileCategory[] = [
  "PROJECT",
  "PHOTO",
  "DIMENSIONS",
  "MEASUREMENT",
  "COMMERCIAL_PROPOSAL",
  "CONTRACT",
  "INVOICE",
  "TECHNICAL",
  "VISUALIZATION",
  "MESSENGER_SCREENSHOT",
  "OTHER",
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export async function analyzeFileWithLlm(args: {
  fileName: string;
  mimeType: string;
  extractedText: string | null;
  /** Base64 без префікса data: — лише для зображень */
  imageBase64: string | null;
  imageMime: string | null;
  heuristicCategory: AiDetectedFileCategory;
}): Promise<{ ok: true; data: LlmFileAnalysis } | { ok: false; error: string }> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    return { ok: false, error: "no_api_key" };
  }

  const system = `Ти аналітик документів для меблевої CRM ENVER (Україна). 
Проаналізуй файл і поверни ЛИШЕ один JSON без markdown. Мова полів українською.

Схема:
{
  "detectedCategory": один з: ${CATEGORY_KEYS.join(", ")},
  "shortSummary": "1-3 речення — суть файлу",
  "detailedSummary": "детальніше, що корисно менеджеру",
  "probablePurpose": "навіщо цей файл у продажах/виробництві",
  "stageRelevance": "який етап воронки (лід/замір/КП/договір/оплата) найбільше підходить",
  "confidenceScore": число 0..1 (наскільки впевнений аналіз),
  "extractedEntities": об'єкт довільних пар ключ-значення (клієнт, адреса, об'єкт тощо) — лише якщо є в даних,
  "extractedMeasurements": масив { "label": string, "widthMm"?: number, "heightMm"?: number, "depthMm"?: number, "note"?: string },
  "extractedAmounts": масив { "amount"?: number, "currency"?: string, "context"?: string },
  "extractedDates": масив ISO-рядків або текстових дат,
  "extractedPeople": масив імен/ролей,
  "extractedMaterials": масив згадок матеріалів/фурнітури,
  "extractedRisks": масив ризиків або складності (ніші, перекіс стін, комунікації) — якщо видно,
  "suggestedActions": масив коротких рекомендацій (напр. "уточнити глибину", "додати фото кута")
}

Правила:
- Не вигадуй числа й імена, яких немає у вхідних даних. Якщо даних мало — низький confidenceScore і короткі масиви.
- Якщо це зображення без читабельного тексту — покладись на візуальний опис.
- heuristicCategory як підказка: ${args.heuristicCategory} — змінюй лише якщо контент явно інший.`;

  type Part =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" | "low" } };

  const userParts: Part[] = [
    {
      type: "text",
      text: `Ім'я файлу: ${args.fileName}\nMIME: ${args.mimeType}\n\nТекст (якщо є):\n${args.extractedText?.trim()?.slice(0, 28_000) ?? "(немає тексту)"}`,
    },
  ];

  if (
    args.imageBase64 &&
    args.imageMime?.startsWith("image/") &&
    args.mimeType.startsWith("image/")
  ) {
    userParts.push({
      type: "image_url",
      image_url: {
        url: `data:${args.imageMime};base64,${args.imageBase64}`,
        detail: "high",
      },
    });
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 2000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userParts },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: errText.slice(0, 200) };
    }

    const raw = await res.text();
    const data = JSON.parse(raw) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) return { ok: false, error: "empty_content" };

    let parsed: unknown;
    try {
      parsed = extractFirstJsonObject(content);
    } catch {
      return { ok: false, error: "json_parse" };
    }

    const j = parsed as Record<string, unknown>;
    const cat = CATEGORY_KEYS.includes(j.detectedCategory as AiDetectedFileCategory)
      ? (j.detectedCategory as AiDetectedFileCategory)
      : args.heuristicCategory;

    const dataOut: LlmFileAnalysis = {
      detectedCategory: cat,
      shortSummary: String(j.shortSummary ?? "").slice(0, 2000),
      detailedSummary: String(j.detailedSummary ?? "").slice(0, 12_000),
      probablePurpose: String(j.probablePurpose ?? "").slice(0, 2000),
      stageRelevance: String(j.stageRelevance ?? "").slice(0, 2000),
      confidenceScore: clamp01(Number(j.confidenceScore)),
      extractedEntities:
        j.extractedEntities && typeof j.extractedEntities === "object" &&
        !Array.isArray(j.extractedEntities)
          ? (j.extractedEntities as Record<string, unknown>)
          : {},
      extractedMeasurements: Array.isArray(j.extractedMeasurements)
        ? j.extractedMeasurements
        : [],
      extractedAmounts: Array.isArray(j.extractedAmounts) ? j.extractedAmounts : [],
      extractedDates: Array.isArray(j.extractedDates) ? j.extractedDates : [],
      extractedPeople: Array.isArray(j.extractedPeople) ? j.extractedPeople : [],
      extractedMaterials: Array.isArray(j.extractedMaterials)
        ? j.extractedMaterials
        : [],
      extractedRisks: Array.isArray(j.extractedRisks) ? j.extractedRisks : [],
      suggestedActions: Array.isArray(j.suggestedActions)
        ? j.suggestedActions.map((x) => String(x).slice(0, 500)).slice(0, 12)
        : [],
    };

    return { ok: true, data: dataOut };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "request_failed",
    };
  }
}
