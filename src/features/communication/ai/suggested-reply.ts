import { extractFirstJsonObject } from "../../../lib/ai/extract-json";

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
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";
  if (!apiKey) {
    return { ok: false, error: "AI не налаштовано (AI_API_KEY)." };
  }

  const system = `Ти менеджер з продажу корпусних меблів ENVER. Мова: українська.
Поверни ЛИШЕ JSON: { "reply": "текст повідомлення клієнту" }.
Не обіцяй конкретні суми/дати, якщо їх немає в контексті. Стиль: ${STYLE_UA[input.style]}.
Етап/контекст: ${input.stageHint ?? "не вказано"}.`;

  const user = `Остання переписка:\n${input.transcript.slice(0, 24_000)}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 900,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: t.slice(0, 300) };
    }
    const raw = await res.text();
    const data = JSON.parse(raw) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    const j = extractFirstJsonObject(content) as { reply?: string };
    const text = typeof j.reply === "string" ? j.reply.trim() : "";
    if (!text) return { ok: false, error: "parse" };
    return { ok: true, text };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fail",
    };
  }
}
