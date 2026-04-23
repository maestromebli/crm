"use client";

import type { DealHealthStatus } from "../../features/deal-workspace/deal-view-selectors";
import { cn } from "../../lib/utils";

export function DealHealthBadge({ стан }: { стан: DealHealthStatus }) {
  return (
    <span
      title={стан.reason}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        стан.level === "blocked" && "border-rose-200 bg-rose-50 text-rose-900",
        стан.level === "at_risk" && "border-amber-200 bg-amber-50 text-amber-900",
        стан.level === "healthy" && "border-emerald-200 bg-emerald-50 text-emerald-900",
      )}
    >
      {стан.label}
    </span>
  );
}
