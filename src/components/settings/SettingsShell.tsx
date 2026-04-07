"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";

const SettingsSectionList = dynamic(
  () =>
    import("./SettingsSectionList").then((m) => ({
      default: m.SettingsSectionList,
    })),
  { ssr: true },
);

type SettingsShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SettingsShell({
  title,
  description,
  children,
}: SettingsShellProps) {
  const pathname = usePathname();

  return (
    <main className="flex min-h-[calc(100vh-56px)] bg-[var(--enver-bg)] px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden rounded-lg border border-slate-200/90 bg-[var(--enver-card)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <SettingsSectionList currentPath={pathname} />
        <section className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <header className="mb-4 border-b border-slate-100 pb-3">
            <h1 className="text-base font-semibold tracking-tight text-[var(--enver-text)] md:text-lg">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-xs text-slate-500 md:text-sm">
                {description}
              </p>
            )}
          </header>
          <div className={cn("space-y-4 md:space-y-5")}>{children}</div>
        </section>
      </div>
    </main>
  );
}

