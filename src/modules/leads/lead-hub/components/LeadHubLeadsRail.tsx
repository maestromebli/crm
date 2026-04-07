"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "../../../../lib/utils";

type Item = { id: string; title: string; stageName: string; updatedAt: string };

const VIEWS: { id: string; label: string }[] = [
  { id: "all", label: "Усі" },
  { id: "mine", label: "Мої" },
  { id: "new", label: "Нові" },
  { id: "overdue", label: "Прострочені" },
];

type Props = {
  currentLeadId: string;
};

export function LeadHubLeadsRail({ currentLeadId }: Props) {
  const [view, setView] = useState("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const sp = new URLSearchParams({ view });
      if (debouncedQ) sp.set("q", debouncedQ);
      const r = await fetch(`/api/leads/hub-rail?${sp.toString()}`);
      const j = (await r.json()) as {
        items?: Item[];
        error?: string | null;
      };
      if (!r.ok) throw new Error("Не вдалося завантажити список");
      if (j.error) setErr(j.error);
      setItems(j.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [view, debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full min-h-[calc(100vh-56px)] flex-col">
      <div className="border-b border-[var(--enver-border)] p-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--enver-muted)]">
          Ліди
        </p>
        <div className="relative mt-2">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--enver-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Пошук…"
            className="w-full rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] py-2 pl-8 pr-2 text-[14px] text-[var(--enver-text)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--enver-muted)] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={cn(
                "rounded-[12px] border px-2 py-1 text-[12px] font-medium transition duration-200 enver-press",
                view === v.id
                  ? "border-[#2563EB] bg-[var(--enver-card)] text-[var(--enver-accent)]"
                  : "border-transparent bg-[var(--enver-card)] text-[var(--enver-muted)] hover:border-[var(--enver-border)]",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {err ? (
          <p className="px-1 text-[12px] text-rose-700">{err}</p>
        ) : null}
        {loading ? (
          <p className="px-2 py-3 text-[12px] text-[var(--enver-muted)]">Завантаження…</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-[12px] text-[var(--enver-muted)]">Нічого не знайдено</p>
        ) : (
          <ul className="space-y-1">
            {items.map((it, idx) => {
              const active = it.id === currentLeadId;
              return (
                <li key={it.id}>
                  <Link
                    href={`/leads/${it.id}`}
                    className={cn(
                      "enver-card-appear block rounded-[12px] border px-2.5 py-2 transition duration-200 enver-hover-lift",
                      active
                        ? "border-[#2563EB] bg-[var(--enver-card)] shadow-[var(--enver-shadow)]"
                        : "border-[var(--enver-border)] bg-[var(--enver-card)] hover:border-[var(--enver-border-strong)]",
                    )}
                    style={{ animationDelay: `${Math.min(idx, 12) * 24}ms` }}
                  >
                    <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--enver-text)]">
                      {it.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--enver-muted)]">
                      {it.stageName}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
