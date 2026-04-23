import type React from "react";
import { Bell, MessageCircle, Sparkles } from "lucide-react";

type AppTopbarProps = {
  title?: string;
  subtitle?: string;
};

export function AppTopbar({
  title = "Операційний дашборд",
  subtitle = "Керуйте лідами, проєктами, замірами та монтажами в одному робочому просторі.",
}: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--enver-border)]/80 bg-[var(--enver-card)] px-4 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.12)] backdrop-blur">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight text-[var(--enver-text)] md:text-base">
          {title}
        </h1>
        <p className="hidden text-xs text-[var(--enver-text-muted)] md:block">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-[var(--enver-border)] bg-[var(--enver-bg)] px-3 py-1.5 text-xs text-[var(--enver-text-muted)] shadow-sm md:flex md:min-w-[220px]">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--enver-surface-elevated)] text-[10px] text-[var(--enver-text)]">
            /
          </span>
          <span className="truncate">
            Пошук по лідах, клієнтах, проєктах…
          </span>
        </div>

        <div className="relative flex items-center gap-1.5 md:gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#2563eb] bg-[#2563eb] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-[#1d4ed8]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden md:inline">
              AI-помічник
            </span>
            <span className="md:hidden">AI</span>
          </button>

          <button
            type="button"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--enver-border)] bg-[var(--enver-card)] text-[var(--enver-text-muted)] shadow-sm shadow-black/20 transition hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]"
          >
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400 text-[8px] font-semibold text-slate-900 shadow-[0_0_8px_rgba(52,211,153,0.9)]">
              3
            </span>
          </button>

          <button
            type="button"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--enver-border)] bg-[var(--enver-card)] text-[var(--enver-text-muted)] shadow-sm shadow-black/20 transition hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>

          <div className="relative inline-flex items-center gap-2 rounded-full border border-[var(--enver-border)] bg-[var(--enver-card)] px-2 py-0.5 text-xs shadow-sm shadow-black/20">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--enver-surface-elevated)] text-[11px] font-semibold text-[var(--enver-text)]">
              UA
            </div>
            <div className="hidden flex-col md:flex">
              <span className="text-[11px] font-medium text-[var(--enver-text)]">
                Демо-користувач
              </span>
              <span className="text-[10px] text-[var(--enver-text-muted)]">
                admin@enver.com
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

