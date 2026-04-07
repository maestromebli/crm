"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  main: ReactNode;
  smartPanel: ReactNode;
  className?: string;
};

/**
 * Dynamic Layer wrapper:
 * keeps existing main content and mounts Smart Panel as optional right rail.
 */
export function CRMLayout({ main, smartPanel, className }: Props) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr] xl:items-start", className)}>
      <div className="min-w-0 space-y-3">{main}</div>
      {smartPanel}
    </div>
  );
}
