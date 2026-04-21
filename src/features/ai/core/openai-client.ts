import { extractFirstJsonObject } from "../../../lib/ai/extract-json";
import {
  estimateCostUsd,
  estimateTokensApproxFromMessages,
  sanitizeAiPayload,
  type AiUsage,
  usageFromProviderResponse,
} from "../../../lib/ai/safety";
import { requestAiProvider } from "../../../lib/ai/provider-request";

export type OpenAiChatParams = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

export type OpenAiJsonResult<T> =
  | {
      ok: true;
      data: T;
      usage: AiUsage | null;
      tokensApprox: number;
      costUsdApprox: number | null;
      model: string;
    }
  | { ok: false; error: string; httpStatus?: number };

export type OpenAiTextResult =
  | {
      ok: true;
      content: string;
      usage: AiUsage | null;
      tokensApprox: number;
      costUsdApprox: number | null;
      model: string;
    }
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

function envTimeoutMs(): number {
  const raw = Number.parseInt(process.env.AI_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(raw)) return 25_000;
  return Math.max(1_000, Math.min(120_000, raw));
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
  const safeMessages = args.messages.map((msg) => ({
    role: msg.role,
    content: sanitizeAiPayload(msg.content),
  }));
  const inputTokensApprox = estimateTokensApproxFromMessages(safeMessages);

  try {
    const providerResult = await requestAiProvider({
      url: `${baseUrl}/chat/completions`,
      apiKey,
      timeoutMs: envTimeoutMs(),
      maxRetries: 2,
      retryBaseDelayMs: 350,
      body: {
        model,
        messages: safeMessages,
        temperature: args.temperature ?? 0.35,
        max_tokens: args.maxTokens ?? 1200,
      },
    });
    if (!providerResult.ok) {
      return {
        ok: false,
        error: providerResult.errorText || `Помилка AI (${providerResult.status})`,
        httpStatus: providerResult.status,
      };
    }

    const raw = await providerResult.response.text();
    let data: {
      choices?: { message?: { content?: string | null } }[];
      usage?: Record<string, unknown>;
    };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      return { ok: false, error: "Некоректна відповідь провайдера ШІ." };
    }

    const usage = usageFromProviderResponse(data);
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return { ok: false, error: "Порожня відповідь моделі." };
    }
    const completionTokensApprox = Math.max(1, Math.ceil(content.length / 4));
    const tokensApprox = usage?.totalTokens ?? inputTokensApprox + completionTokensApprox;
    const costUsdApprox = estimateCostUsd(model, usage);
    return {
      ok: true,
      content,
      usage,
      tokensApprox,
      costUsdApprox,
      model,
    };
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

    return {
      ok: true,
      data: parsed as T,
      usage: result.usage,
      tokensApprox: result.tokensApprox,
      costUsdApprox: result.costUsdApprox,
      model: result.model,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Помилка звернення до провайдера ШІ.",
    };
  }
}
