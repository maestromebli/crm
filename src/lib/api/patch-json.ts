import { parseResponseJson } from "./parse-response-json";

async function requestJson<T>(
  method: "PATCH" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: Record<string, unknown>,
  init?: { credentials?: RequestCredentials },
): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(init?.credentials ? { credentials: init.credentials } : {}),
  });
  const j = await parseResponseJson<
    T & { error?: string; message?: string; details?: string }
  >(r);
  if (!r.ok) {
    const detail =
      typeof j.details === "string" && j.details.trim()
        ? `\n\n${j.details.trim()}`
        : "";
    throw new Error((j.error ?? j.message ?? "Помилка") + detail);
  }
  return j as T;
}

export async function patchJson<T>(
  url: string,
  body: Record<string, unknown>,
  init?: { credentials?: RequestCredentials },
): Promise<T> {
  return requestJson<T>("PATCH", url, body, init);
}

export async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
  init?: { credentials?: RequestCredentials },
): Promise<T> {
  return requestJson<T>("POST", url, body, init);
}

export async function putJson<T>(
  url: string,
  body: Record<string, unknown>,
  init?: { credentials?: RequestCredentials },
): Promise<T> {
  return requestJson<T>("PUT", url, body, init);
}

export async function deleteJson<T>(
  url: string,
  body?: Record<string, unknown>,
  init?: { credentials?: RequestCredentials },
): Promise<T> {
  return requestJson<T>("DELETE", url, body, init);
}

export async function postFormData<T>(
  url: string,
  formData: FormData,
  init?: { credentials?: RequestCredentials },
): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    body: formData,
    ...(init?.credentials ? { credentials: init.credentials } : {}),
  });
  const j = await parseResponseJson<
    T & { error?: string; message?: string; details?: string }
  >(r);
  if (!r.ok) {
    const detail =
      typeof j.details === "string" && j.details.trim()
        ? `\n\n${j.details.trim()}`
        : "";
    throw new Error((j.error ?? j.message ?? "Помилка") + detail);
  }
  return j as T;
}
