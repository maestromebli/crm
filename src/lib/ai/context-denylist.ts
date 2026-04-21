const SENSITIVE_KEY_RE =
  /(password|pass|pwd|token|secret|api[_-]?key|authorization|cookie|session|iban|card|cvv|pin|account|phone|email|ownerid|contactid|note|description)/i;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE =
  /(?<!\w)(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,3}\)?[\s-]?)?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2,3}(?!\w)/g;

function redactString(value: string): string {
  return value
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(PHONE_RE, "[REDACTED_PHONE]");
}

export function redactContextForAi(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED_NESTED_CONTEXT]";
  if (typeof value === "string") return redactString(value);
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactContextForAi(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = "[REDACTED_FIELD]";
      continue;
    }
    out[key] = redactContextForAi(raw, depth + 1);
  }
  return out;
}
