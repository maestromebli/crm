"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { TargetRefreshButton } from "./components/TargetRefreshButton";

export type TargetTab = {
  href: string;
  label: string;
};

type TargetShellProps = {
  title: string;
  description: string;
  tabs: TargetTab[];
  children: React.ReactNode;
};

export function TargetShell({
  title,
  description,
  tabs,
  children,
}: TargetShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)] px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4">
        <nav className="text-[11px] text-slate-500">
          <Link href="/target" className="text-orange-700 hover:underline">
            Таргет
          </Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="font-medium text-slate-800">{title}</span>
        </nav>

        <header className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Реклама · Meta
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
                {title}
              </h1>
              <p className="mt-1 max-w-3xl text-xs text-slate-600 md:text-sm">
                {description}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <TargetRefreshButton />
              <Link
                href="/settings/integrations/meta-target"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-[var(--enver-card)]"
              >
                Ключі API
              </Link>
            </div>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => {
              const active =
                pathname === t.href ||
                (t.href === "/target" && pathname === "/target");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "border-orange-200 bg-orange-50 text-orange-950"
                      : "border-transparent bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-[var(--enver-card)] hover:text-[var(--enver-text)]",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </header>

        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}
