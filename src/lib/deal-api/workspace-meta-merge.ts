import type { Prisma } from "@prisma/client";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Поверхневе злиття patch у workspaceMeta замовлення. */
export function mergeWorkspaceMeta(
  existing: Prisma.JsonValue | null,
  patch: Partial<DealWorkspaceMeta>,
): Prisma.InputJsonValue {
  const base: Record<string, unknown> = isPlainObject(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {};

  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    if (val === null) {
      delete base[key];
      continue;
    }
    base[key] = val as unknown;
  }

  return base as Prisma.InputJsonValue;
}
