import crypto from "node:crypto";

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function renderContractHtml(
  templateHtml: string,
  payload: Record<string, unknown>,
) {
  const escapeHtml = (value: unknown): string =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const html = templateHtml.replace(/{{\s*([\w.]+)\s*}}/g, (_, token) => {
    const value = resolvePath(payload, token);
    return value == null ? "" : escapeHtml(value);
  });

  const hash = crypto.createHash("sha256").update(html).digest("hex");
  return { html, hash };
}
