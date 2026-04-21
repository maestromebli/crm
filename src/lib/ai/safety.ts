export type AiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE =
  /(?<!\w)(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,3}\)?[\s-]?)?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2,3}(?!\w)/g;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi;
const SENSITIVE_KEY_RE =
  /(password|pass|pwd|token|secret|api[_-]?key|authorization|cookie|session|iban|card|cvv|pin|account)/i;

const MODEL_PRICE_USD_PER_1M: Record<
  string,
  { prompt: number; completion: number }
> = {
  "gpt-4.1-mini": { prompt: 0.4, completion: 1.6 },
  "gpt-4.1": { prompt: 2, completion: 8 },
  "gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
  "gpt-4o": { prompt: 2.5, completion: 10 },
};

export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(PHONE_RE, "[REDACTED_PHONE]")
    .replace(CARD_RE, "[REDACTED_CARD]")
    .replace(IBAN_RE, "[REDACTED_IBAN]");
}

function sanitizeByKey(key: string | null, value: string): string {
  if (key && SENSITIVE_KEY_RE.test(key)) {
    return "[REDACTED_SENSITIVE_FIELD]";
  }
  return redactSensitiveText(value);
}

export function sanitizeAiPayload(
  value: unknown,
  depth = 0,
  parentKey: string | null = null,
): unknown {
  if (depth > 8) return "[TRUNCATED_NESTED_PAYLOAD]";
  if (typeof value === "string") return sanitizeByKey(parentKey, value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAiPayload(item, depth + 1, parentKey));
  }
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = sanitizeAiPayload(v, depth + 1, k);
  }
  return out;
}

export function usageFromProviderResponse(data: unknown): AiUsage | null {
  const usage = (data as { usage?: Record<string, unknown> })?.usage;
  if (!usage || typeof usage !== "object") return null;
  const promptTokens = Number(usage.prompt_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? 0);
  const totalTokens = Number(
    usage.total_tokens ?? promptTokens + completionTokens,
  );
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return null;
  return {
    promptTokens: Math.max(0, Math.floor(promptTokens)),
    completionTokens: Math.max(0, Math.floor(completionTokens)),
    totalTokens: Math.max(0, Math.floor(totalTokens)),
  };
}

export function estimateTokensApproxFromText(input: string): number {
  const chars = input.trim().length;
  if (chars <= 0) return 0;
  return Math.max(1, Math.ceil(chars / 4));
}

export function estimateTokensApproxFromMessages(
  messages: Array<{ content?: unknown }>,
): number {
  let total = 0;
  for (const message of messages) {
    if (typeof message.content === "string") {
      total += estimateTokensApproxFromText(message.content);
      continue;
    }
    const serialized = JSON.stringify(message.content ?? "");
    total += estimateTokensApproxFromText(serialized);
  }
  return total;
}

export function estimateCostUsd(model: string, usage: AiUsage | null): number | null {
  if (!usage) return null;
  const tariff = MODEL_PRICE_USD_PER_1M[model];
  if (!tariff) return null;
  const promptCost = (usage.promptTokens / 1_000_000) * tariff.prompt;
  const completionCost = (usage.completionTokens / 1_000_000) * tariff.completion;
  const total = promptCost + completionCost;
  return Number.isFinite(total) ? Number(total.toFixed(6)) : null;
}
