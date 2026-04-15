"use client";

import type { DealHealthStatus } from "../../features/deal-workspace/deal-view-selectors";
import { cn } from "../../lib/utils";

export function DealHealthBadge({ health }: { health: DealHealthStatus }) {
  return (
    <span
      title={health.reason}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        health.level === "blocked" && "border-rose-200 bg-rose-50 text-rose-900",
        health.level === "at_risk" && "border-amber-200 bg-amber-50 text-amber-900",
        health.level === "healthy" && "border-emerald-200 bg-emerald-50 text-emerald-900",
      )}
    >
      {health.label}
    </span>
  );
}
