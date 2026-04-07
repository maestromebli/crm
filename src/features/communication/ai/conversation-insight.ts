import { extractFirstJsonObject } from "../../../lib/ai/extract-json";

export type ConversationInsightPayload = {
  summaryShort: string;
  summaryDetailed: string;
  clientIntent: string;
  extractedNeeds: string[];
  extractedMeasurements: Array<{ label?: string; note?: string }>;
  extractedMaterials: string[];
  extractedBudget: string | null;
  extractedDates: string[];
  extractedRisks: string[];
  missingInfo: string[];
  recommendedNextStep: string;
  recommendedReply: string;
  confidenceScore: number;
};

const SYSTEM = `Ти аналітик переписки для меблевої CRM ENVER (Україна).
Поверни ЛИШЕ один JSON (без markdown) українською.

Схема:
{
  "summaryShort": "2-4 речення",
  "summaryDetailed": "структуровано: що відбувається",
  "clientIntent": "коротко: що хоче клієнт",
  "extractedNeeds": ["..."],
  "extractedMeasurements": [{ "label": "...", "note": "..." }],
  "extractedMaterials": ["..."],
  "extractedBudget": "рядок або null",
  "extractedDates": ["..."],
  "extractedRisks": ["..."],
  "missingInfo": ["що не вистачає для наступного кроку"],
  "recommendedNextStep": "один конкретний крок для менеджера",
  "recommendedReply": "чернетка відповіді клієнту (без обіцянок цін/термінів якщо їх немає в тексті)",
  "confidenceScore": 0..1
}

Правила: не вигадуй факти. Якщо даних мало — низька confidenceScore і короткі масиви.`;

export async function generateConversationInsight(input: {
  transcript: string;
}): Promise<
  | { ok: true; data: ConversationInsightPayload }
  | { ok: false; error: string }
> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";
  if (!apiKey) {
    return { ok: false, error: "AI не налаштовано (AI_API_KEY)." };
  }

  const user = `Переписка (хронологічно):\n${input.transcript.slice(0, 28_000)}`;

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
        max_tokens: 2200,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: t.slice(0, 400) };
    }
    const raw = await res.text();
    const data = JSON.parse(raw) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) return { ok: false, error: "empty" };
    const parsed = extractFirstJsonObject(content) as ConversationInsightPayload;
    return { ok: true, data: parsed };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "request_failed",
    };
  }
}
