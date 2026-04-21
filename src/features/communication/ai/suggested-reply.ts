import { extractFirstJsonObject } from "../../../lib/ai/extract-json";
import {
  isOpenAiTextError,
  openAiChatCompletionText,
} from "../../ai/core/openai-client";

export type ReplyStyle =
  | "short"
  | "standard"
  | "premium"
  | "polite"
  | "assertive"
  | "follow_up"
  | "objection";

const STYLE_UA: Record<ReplyStyle, string> = {
  short: "дуже коротко (2-4 речення)",
  standard: "стандартно, професійно",
  premium: "преміально, тепло, без пафосу",
  polite: "ввічливо, м’яко",
  assertive: "наполегливо, але коректно",
  follow_up: "м’який фоллоуап без тиску",
  objection: "відповідь на заперечення щодо ціни/термінів — без обіцянок без підстав",
};

export async function generateSuggestedReply(input: {
  transcript: string;
  style: ReplyStyle;
  stageHint?: string | null;
}): Promise<
  | {
      ok: true;
      text: string;
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
  const system = `Ти менеджер з продажу корпусних меблів ENVER. Мова: українська.
Поверни ЛИШЕ JSON: { "reply": "текст повідомлення клієнту" }.
Не обіцяй конкретні суми/дати, якщо їх немає в контексті. Стиль: ${STYLE_UA[input.style]}.
Етап/контекст: ${input.stageHint ?? "не вказано"}.`;

  const user = `Остання переписка:\n${input.transcript.slice(0, 24_000)}`;

  try {
    const res = await openAiChatCompletionText({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.45,
      maxTokens: 900,
    });
    if (isOpenAiTextError(res)) {
      return { ok: false, error: res.error };
    }
    const content = res.content;
    const j = extractFirstJsonObject(content) as { reply?: string };
    const text = typeof j.reply === "string" ? j.reply.trim() : "";
    if (!text) return { ok: false, error: "parse" };
    return {
      ok: true,
      text,
      usage: res.usage,
      tokensApprox: res.tokensApprox,
      costUsdApprox: res.costUsdApprox,
      model: res.model,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fail",
    };
  }
}
