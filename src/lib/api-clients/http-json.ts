/**
 * Обгортка для клієнтських викликів до внутрішніх JSON API (Next route handlers).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(input, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(
      `HTTP ${res.status}: ${text.slice(0, 240)}`,
      res.status,
      text,
    );
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
