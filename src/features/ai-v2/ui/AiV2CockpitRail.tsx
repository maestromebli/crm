"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AiV2InsightCard } from "./AiV2InsightCard";

export function AiV2CockpitRail() {
  const [open, setOpen] = useState(false);

  return (
    <aside
      className={cn(
        "pointer-events-none fixed right-0 top-24 z-40 hidden max-h-[calc(100vh-7rem)] w-[380px] pr-2 lg:block",
        open ? "translate-x-0" : "translate-x-[332px]",
        "transition-transform duration-300",
      )}
      aria-label="AI V2 cockpit rail"
    >
      <div className="pointer-events-auto flex h-full gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-l-xl border border-[var(--enver-border)] bg-[var(--enver-card)] text-[var(--enver-text)] shadow-sm"
          aria-expanded={open}
          aria-label={open ? "Згорнути AI V2 cockpit" : "Розгорнути AI V2 cockpit"}
          title={open ? "Згорнути AI V2 cockpit" : "Розгорнути AI V2 cockpit"}
        >
          {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <div className="w-[330px] overflow-y-auto rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-bg)] p-2 shadow-xl">
          <AiV2InsightCard context="dashboard" />
        </div>
      </div>
    </aside>
  );
}
