type ExternalJsonOk<T> = {
  ok: true;
  status: number;
  data: T;
};

type ExternalJsonErr = {
  ok: false;
  status: number;
  text: string;
  data: unknown;
};

export type ExternalJsonResult<T> = ExternalJsonOk<T> | ExternalJsonErr;

type ExternalBinaryOk = {
  ok: true;
  status: number;
  data: ArrayBuffer;
};

type ExternalBinaryErr = {
  ok: false;
  status: number;
  text: string;
};

export type ExternalBinaryResult = ExternalBinaryOk | ExternalBinaryErr;

export async function externalRequestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ExternalJsonResult<T>> {
  const res = await fetch(input, init);
  const text = await res.text();
  let data: unknown = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      text,
      data,
    };
  }
  return {
    ok: true,
    status: res.status,
    data: data as T,
  };
}

export async function externalGetJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ExternalJsonResult<T>> {
  return externalRequestJson<T>(input, { ...init, method: "GET" });
}

export async function externalGetArrayBuffer(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ExternalBinaryResult> {
  const res = await fetch(input, { ...init, method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      text,
    };
  }
  const data = await res.arrayBuffer();
  return {
    ok: true,
    status: res.status,
    data,
  };
}

export async function externalPostJson<T>(
  input: RequestInfo | URL,
  body: unknown,
  init?: RequestInit,
): Promise<ExternalJsonResult<T>> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return externalRequestJson<T>(input, {
    ...init,
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
