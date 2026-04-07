"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent } from "react";
import { Search } from "lucide-react";
import { cn } from "../../../lib/utils";

const VIEWS: { id: string; label: string }[] = [
  { id: "director", label: "Директор" },
  { id: "sales", label: "Продажі" },
  { id: "finance", label: "Фінанси" },
  { id: "production", label: "Виробництво" },
  { id: "issues", label: "Проблемні" },
];

export function FilterBar() {
  const sp = useSearchParams();
  const router = useRouter();
  const href = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") u.delete(k);
      else u.set(k, v);
    }
    return `/crm/dashboard?${u.toString()}`;
  };

  const view = sp.get("view") ?? "director";

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    const u = new URLSearchParams(sp.toString());
    if (q) u.set("q", q);
    else u.delete("q");
    router.push(`/crm/dashboard?${u.toString()}`);
  };

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-3 shadow-[var(--enver-shadow)] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={href({ view: v.id })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              view === v.id
                ? "bg-[var(--enver-text)] text-white shadow-sm"
                : "bg-[var(--enver-surface)] text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)]",
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>
      <form
        onSubmit={onSearch}
        className="flex w-full max-w-md items-center gap-2 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-1.5 lg:w-auto"
      >
        <Search className="h-4 w-4 shrink-0 text-[var(--enver-muted)]" />
        <input
          name="q"
          defaultValue={sp.get("q") ?? ""}
          placeholder="Швидкий пошук (фільтрує джерело / менеджера в URL)…"
          className="w-full min-w-0 bg-transparent text-sm text-[var(--enver-text)] outline-none placeholder:text-[var(--enver-muted)]"
        />
      </form>
    </div>
  );
}
