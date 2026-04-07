import type { ProductionStageName } from "@prisma/client";
import { stageLabelUa } from "./default-stages";

/** Підпис етапу для legacy-сторінок / звітів (без старого enum лінії). */
export function floorStageLabelUa(stage: string): string {
  if (stage === "WAITING") return "Очікування";
  try {
    return stageLabelUa(stage as ProductionStageName);
  } catch {
    return stage;
  }
}

export function floorStageShortUa(stage: string): string {
  return floorStageLabelUa(stage);
}

export function getFloorCapacities(): Record<string, number> {
  const n = (key: string, fallback: number) => {
    const v = process.env[key]?.trim();
    if (!v) return fallback;
    const x = Number.parseInt(v, 10);
    return Number.isFinite(x) && x > 0 ? x : fallback;
  };
  return {
    CUTTING: n("PRODUCTION_CAP_CUTTING", 4),
    EDGING: n("PRODUCTION_CAP_EDGING", 3),
    DRILLING: n("PRODUCTION_CAP_DRILLING", 3),
    ASSEMBLY: n("PRODUCTION_CAP_ASSEMBLY", 4),
  };
}

export function utilizationPercent(count: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((count / capacity) * 100));
}

/** Legacy: операційний борд (якщо ще імпортується). */
export const FLOOR_STAGE_ORDER = [
  "CUTTING",
  "EDGING",
  "DRILLING",
  "ASSEMBLY",
  "PACKAGING",
] as const;
