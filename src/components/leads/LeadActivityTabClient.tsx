"use client";

import { useEffect, useMemo, useState } from "react";
import {
  format,
  formatDistanceToNow,
  isThisYear,
  isToday,
  isYesterday,
  startOfDay,
} from "date-fns";
import { uk } from "date-fns/locale";
import {
  FileUp,
  History,
  MessageCircle,
  PenLine,
  Sparkles,
  UserPlus,
} from "lucide-react";

import type { LeadActivityCategory } from "../../lib/leads/lead-activity-display";
import { sourceLabelUa } from "../../lib/leads/lead-activity-display";

type ActivityItem = {
  id: string;
  headline: string;
  type: string;
  detail: string;
  category: LeadActivityCategory;
  source: string;
  createdAt: string;
  actor: string | null;
};

type FilterId = "all" | LeadActivityCategory;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Усі події" },
  { id: "dialog", label: "Діалог" },
  { id: "file", label: "Файли" },
  { id: "card", label: "Картка ліда" },
  { id: "system", label: "AI та система" },
];

function dayKey(iso: string) {
  return startOfDay(new Date(iso)).toISOString();
}

function formatDayHeading(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Сьогодні";
  if (isYesterday(d)) return "Вчора";
  if (isThisYear(d)) {
    return format(d, "d MMMM", { locale: uk });
  }
  return format(d, "d MMMM yyyy", { locale: uk });
}

function iconForItem(category: LeadActivityCategory, type: string) {
  if (category === "file") return FileUp;
  if (category === "dialog") return MessageCircle;
  if (category === "system") return Sparkles;
  if (type === "LEAD_CREATED") return UserPlus;
  return PenLine;
}

type Props = { leadId: string };

export function LeadActivityTabClient({ leadId }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`/api/leads/${leadId}/activity`);
        const j = (await r.json()) as {
          items?: ActivityItem[];
          error?: string;
        };
        if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити");
        if (!cancelled) setItems(j.items ?? []);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Помилка");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => it.category === filter);
  }, [items, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const it of filtered) {
      const k = dayKey(it.createdAt);
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    return [...map.entries()].sort((a, b) =>
      b[0].localeCompare(a[0]),
    );
  }, [filtered]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <History className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[var(--enver-text)]">
                Історія
              </h2>
              <p className="mt-0.5 max-w-xl text-sm text-slate-600">
                Хронологія змін, файлів і повідомлень по цьому ліду — зрозумілою
                мовою, без технічних дампів.
              </p>
            </div>
          </div>
        </div>

        <div
          className="mt-4 flex flex-wrap gap-2"
          role="group"
          aria-label="Фільтр подій"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-[var(--enver-card)]",
                ].join(" ")}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-5 md:px-6">
        {err ? (
          <p className="text-sm text-rose-700" role="alert">
            {err}
          </p>
        ) : loading ? (
          <ul className="space-y-4" aria-busy="true" aria-label="Завантаження">
            {[1, 2, 3, 4, 5].map((i) => (
              <li
                key={i}
                className="flex gap-3 animate-pulse"
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <div className="h-3 w-2/3 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-50" />
                </div>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--enver-card)] shadow-sm ring-1 ring-slate-100">
              <History className="h-6 w-6 text-slate-400" aria-hidden />
            </div>
            <p className="text-sm font-medium text-slate-800">
              {items.length === 0
                ? "Поки немає подій"
                : "Немає подій у цьому фільтрі"}
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-600">
              {items.length === 0
                ? "Коли змінюватиметься картка, додаватимуться файли чи записи в діалозі, вони зʼявляться тут у зворотному хронологічному порядку."
                : "Спробуйте інший фільтр або «Усі події»."}
            </p>
          </div>
        ) : (
          <div className="relative">
            <div
              className="pointer-events-none absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent md:left-[21px]"
              aria-hidden
            />
            <div className="space-y-8">
              {grouped.map(([dayIso, dayItems]) => (
                <div key={dayIso}>
                  <h3 className="sticky top-0 z-10 mb-3 inline-flex rounded-lg bg-[var(--enver-card)]/95 px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
                    {formatDayHeading(dayIso)}
                  </h3>
                  <ul className="space-y-0">
                    {dayItems.map((it) => {
                      const Icon = iconForItem(it.category, it.type);
                      const rel = formatDistanceToNow(new Date(it.createdAt), {
                        addSuffix: true,
                        locale: uk,
                      });
                      const abs = format(
                        new Date(it.createdAt),
                        "HH:mm",
                        { locale: uk },
                      );
                      return (
                        <li
                          key={it.id}
                          className="relative flex gap-3 pb-6 last:pb-0"
                        >
                          <div className="relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-[var(--enver-card)] shadow-sm">
                            <Icon
                              className="h-4 w-4 text-indigo-600"
                              aria-hidden
                            />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-sm font-semibold text-[var(--enver-text)]">
                              {it.headline}
                            </p>
                            {it.detail ? (
                              <p className="mt-1 text-sm leading-snug text-slate-600">
                                {it.detail}
                              </p>
                            ) : null}
                            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                              <time
                                dateTime={it.createdAt}
                                title={format(
                                  new Date(it.createdAt),
                                  "d MMMM yyyy, HH:mm",
                                  { locale: uk },
                                )}
                              >
                                {rel}
                              </time>
                              <span className="text-slate-300" aria-hidden>
                                ·
                              </span>
                              <span>{abs}</span>
                              {it.actor ? (
                                <>
                                  <span className="text-slate-300" aria-hidden>
                                    ·
                                  </span>
                                  <span className="text-slate-600">
                                    {it.actor}
                                  </span>
                                </>
                              ) : null}
                              <span className="text-slate-300" aria-hidden>
                                ·
                              </span>
                              <span className="text-slate-400">
                                {sourceLabelUa(it.source)}
                              </span>
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
