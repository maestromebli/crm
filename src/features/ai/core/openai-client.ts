import { extractFirstJsonObject } from "../../../lib/ai/extract-json";

export type OpenAiChatParams = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

export type OpenAiJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; httpStatus?: number };

export type OpenAiTextResult =
  | { ok: true; content: string }
  | { ok: false; error: string; httpStatus?: number };

export function isOpenAiTextError(
  result: OpenAiTextResult,
): result is Extract<OpenAiTextResult, { ok: false }> {
  return result.ok === false;
}

function envModel(): string {
  return process.env.AI_MODEL ?? "gpt-4.1-mini";
}

function envBaseUrl(): string {
  return process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
}

export async function openAiChatCompletionText(args: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: unknown }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<OpenAiTextResult> {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "AI не налаштовано (немає AI_API_KEY)." };
  }
  const baseUrl = envBaseUrl();
  const model = envModel();

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: args.messages,
        temperature: args.temperature ?? 0.35,
        max_tokens: args.maxTokens ?? 1200,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Помилка AI (${response.status})`,
        httpStatus: response.status,
      };
    }

    const raw = await response.text();
    let data: { choices?: { message?: { content?: string | null } }[] };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      return { ok: false, error: "Некоректна відповідь провайдера ШІ." };
    }

    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return { ok: false, error: "Порожня відповідь моделі." };
    }
    return { ok: true, content };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Помилка звернення до провайдера ШІ.",
    };
  }
}

/**
 * Виклик Chat Completions з очікуванням JSON-об'єкта у відповіді.
 */
export async function openAiChatJson<T>(
  params: OpenAiChatParams,
): Promise<OpenAiJsonResult<T>> {
  const result = await openAiChatCompletionText({
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    temperature: params.temperature ?? 0.35,
    maxTokens: params.maxTokens ?? 1200,
  });
  if (isOpenAiTextError(result)) {
    return {
      ok: false,
      error: result.error,
      httpStatus: result.httpStatus,
    };
  }
  try {
    const content = result.content;

    let parsed: unknown;
    try {
      parsed = extractFirstJsonObject(content);
    } catch {
      return { ok: false, error: "Не вдалося розпарсити JSON від моделі." };
    }

    return { ok: true, data: parsed as T };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Помилка звернення до провайдера ШІ.",
    };
  }
}
