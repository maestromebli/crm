type ProviderRequestParams = {
  url: string;
  apiKey: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
};

type ProviderRequestOk = {
  ok: true;
  response: Response;
  attempts: number;
};

type ProviderRequestFail = {
  ok: false;
  status: number;
  errorText: string;
  attempts: number;
  timedOut: boolean;
};

export type ProviderRequestResult = ProviderRequestOk | ProviderRequestFail;

const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function requestAiProvider(
  params: ProviderRequestParams,
): Promise<ProviderRequestResult> {
  const timeoutMs = clampInt(params.timeoutMs ?? 25_000, 25_000, 1_000, 120_000);
  const maxRetries = clampInt(params.maxRetries ?? 2, 2, 0, 5);
  const retryBaseDelayMs = clampInt(
    params.retryBaseDelayMs ?? 350,
    350,
    50,
    10_000,
  );
  const totalAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        params.url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${params.apiKey}`,
          },
          body: JSON.stringify(params.body),
        },
        timeoutMs,
      );

      if (response.ok) {
        return { ok: true, response, attempts: attempt };
      }

      const errorText = await response.text();
      const shouldRetry =
        RETRYABLE_STATUS_CODES.has(response.status) && attempt < totalAttempts;

      if (!shouldRetry) {
        return {
          ok: false,
          status: response.status,
          errorText: errorText || `Помилка AI (${response.status})`,
          attempts: attempt,
          timedOut: false,
        };
      }

      const delay = retryBaseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    } catch (error) {
      const timedOut = isAbortError(error);
      if (attempt >= totalAttempts) {
        return {
          ok: false,
          status: timedOut ? 504 : 0,
          errorText: timedOut
            ? `Таймаут AI-провайдера (${timeoutMs} мс)`
            : error instanceof Error
              ? error.message
              : "Помилка звернення до провайдера ШІ.",
          attempts: attempt,
          timedOut,
        };
      }

      const delay = retryBaseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }

  return {
    ok: false,
    status: 0,
    errorText: "Невідома помилка звернення до провайдера ШІ.",
    attempts: 0,
    timedOut: false,
  };
}
