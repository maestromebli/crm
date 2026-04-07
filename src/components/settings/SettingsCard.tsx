"use client";

import type React from "react";
import { cn } from "../../lib/utils";

type SettingsCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SettingsCard({
  title,
  description,
  children,
}: SettingsCardProps) {
  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-xs">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </p>
        {description && (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {description}
          </p>
        )}
      </div>
      <div className={cn("space-y-1.5")}>{children}</div>
    </section>
  );
}

