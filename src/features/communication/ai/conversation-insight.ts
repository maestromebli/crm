import { extractFirstJsonObject } from "../../../lib/ai/extract-json";
import {
  isOpenAiTextError,
  openAiChatCompletionText,
} from "../../ai/core/openai-client";

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
  | {
      ok: true;
      data: ConversationInsightPayload;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      } | null;
      tokensApprox: number;
      costUsdApprox: number | null;
      model: string;
    }
  | { ok: false; error: string }
> {
  const user = `Переписка (хронологічно):\n${input.transcript.slice(0, 28_000)}`;

  try {
    const res = await openAiChatCompletionText({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      temperature: 0.25,
      maxTokens: 2200,
    });
    if (isOpenAiTextError(res)) {
      return { ok: false, error: res.error };
    }
    const content = res.content;
    if (!content) return { ok: false, error: "empty" };
    const parsed = extractFirstJsonObject(content) as ConversationInsightPayload;
    return {
      ok: true,
      data: parsed,
      usage: res.usage,
      tokensApprox: res.tokensApprox,
      costUsdApprox: res.costUsdApprox,
      model: res.model,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "request_failed",
    };
  }
}
