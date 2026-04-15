"use client";

import { Activity, AlertTriangle, CircleCheck, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSTRUCTOR_STATUS_CLASS, CONSTRUCTOR_STATUS_LABEL } from "../constructor-hub.labels";
import type { ConstructorHubStatus } from "../constructor-hub.types";

export function ConstructorStatusBadge({ status }: { status: ConstructorHubStatus }) {
  const Icon =
    status === "APPROVED" || status === "HANDED_OFF"
      ? CircleCheck
      : status === "HAS_QUESTIONS" || status === "NEEDS_REWORK"
        ? AlertTriangle
        : status === "UNASSIGNED"
          ? PauseCircle
          : Activity;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        CONSTRUCTOR_STATUS_CLASS[status],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {CONSTRUCTOR_STATUS_LABEL[status]}
    </span>
  );
}
