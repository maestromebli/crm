"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCcw } from "lucide-react";
import { SummaryCard } from "@/components/shared/SummaryCard";
import { cn } from "@/lib/utils";
import {
  REPORT_RANGES,
  REPORT_SECTIONS,
  type ReportPayload,
  type ReportRange,
  type ReportSection,
} from "./types";

const SECTION_META: Record<
  ReportSection,
  { label: string; href: string; description: string }
> = {
  sales: {
    label: "Продажі",
    href: "/reports/sales",
    description: "Воронка замовлень, win-rate, середній чек.",
  },
  conversion: {
    label: "Конверсія лідів",
    href: "/reports/conversion",
    description: "Шлях від ліда до замовлення.",
  },
  team: {
    label: "Команда",
    href: "/reports/team",
    description: "Продуктивність і дисципліна задач.",
  },
  load: {
    label: "Навантаження виробництва",
    href: "/reports/load",
    description: "Розподіл задач по типах і виконавцях.",
  },
  installations: {
    label: "Монтажі",
    href: "/reports/installations",
    description: "План/факт монтажів і найближчі дати.",
  },
  sla: {
    label: "SLA відповіді",
    href: "/reports/sla",
    description: "Контроль дедлайнів і прострочень.",
  },
  files: {
    label: "Заповненість файлів",
    href: "/reports/files",
    description: "Покриття замовлень файлами та категорії.",
  },
  custom: {
    label: "Кастомні звіти",
    href: "/reports/custom",
    description: "Шаблони зрізів під роль і процес.",
  },
};

const RANGE_LABEL: Record<ReportRange, string> = {
  "7d": "7 днів",
  "30d": "30 днів",
  "90d": "90 днів",
};

function normalizeSection(raw: string): ReportSection {
  return REPORT_SECTIONS.includes(raw as ReportSection)
    ? (raw as ReportSection)
    : "sales";
}

function buildCsv(payload: ReportPayload): string {
  const lines = payload.rows.map((row) =>
    [
      `"${row.label.replace(/"/g, '""')}"`,
      `"${row.primary.replace(/"/g, '""')}"`,
      `"${(row.secondary ?? "").replace(/"/g, '""')}"`,
    ].join(","),
  );
  return `\uFEFFПоказник,Значення,Деталі\n${lines.join("\n")}`;
}

export function ReportsHubClient({ activeSection }: { activeSection: string }) {
  const section = useMemo(() => normalizeSection(activeSection), [activeSection]);
  const [range, setRange] = useState<ReportRange>("30d");
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/reports?section=${section}&range=${range}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | (ReportPayload & { error?: string })
        | null;
      if (!res.ok || !json) {
        setData(null);
        setError(json?.error ?? "Не вдалося завантажити звіт");
        return;
      }
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Не вдалося завантажити звіт");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, section]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const downloadCsv = useCallback(() => {
    if (!data) return;
    const blob = new Blob([buildCsv(data)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `report-${data.section}-${data.range}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [data]);

  const maxChart = useMemo(() => {
    if (!data?.chart.length) return 1;
    return Math.max(1, ...data.chart.map((point) => point.value));
  }, [data?.chart]);

  return (
    <div className="enver-page-shell flex flex-col px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-7xl flex-1 space-y-4">
        <header className="enver-panel enver-panel--interactive px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="enver-eyebrow">Аналітика CRM</p>
              <h1 className="text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
                {SECTION_META[section].label}
              </h1>
              <p className="text-xs text-[var(--enver-text-muted)] md:text-sm">
                {SECTION_META[section].description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {REPORT_RANGES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRange(item)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    range === item
                      ? "border-[var(--enver-accent)] bg-[var(--enver-accent)] text-white"
                      : "border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text)] hover:bg-[var(--enver-hover)]",
                  )}
                >
                  {RANGE_LABEL[item]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-xs font-medium text-[var(--enver-text)] transition hover:bg-[var(--enver-hover)]"
              >
                <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                Оновити
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                disabled={!data}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-xs font-medium text-[var(--enver-text)] transition hover:bg-[var(--enver-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
          </div>
        </header>

        <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {REPORT_SECTIONS.map((item) => (
            <Link
              key={item}
              href={SECTION_META[item].href}
              className={cn(
                "rounded-xl border px-3 py-2.5 transition-colors",
                section === item
                  ? "border-[var(--enver-accent)] bg-[var(--enver-accent-soft)]"
                  : "border-[var(--enver-border)] bg-[var(--enver-card)] hover:bg-[var(--enver-hover)]",
              )}
            >
              <p className="text-xs font-semibold text-[var(--enver-text)]">
                {SECTION_META[item].label}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--enver-text-muted)]">
                {SECTION_META[item].description}
              </p>
            </Link>
          ))}
        </nav>

        {loading ? (
          <div className="enver-empty px-4 py-10 text-center text-sm text-[var(--enver-text-muted)]">
            Завантажую звіт...
          </div>
        ) : error ? (
          <div className="enver-empty border-rose-200 bg-rose-50 px-4 py-8 text-sm text-rose-700">
            {error}
          </div>
        ) : data ? (
          <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {data.kpis.map((kpi) => (
                <SummaryCard
                  key={kpi.id}
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.hint}
                />
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr,1fr]">
              <article className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
                  Тренд
                </p>
                <h2 className="mt-1 text-sm font-semibold text-[var(--enver-text)]">
                  {data.title}
                </h2>
                <p className="mt-1 text-xs text-[var(--enver-text-muted)]">{data.subtitle}</p>
                <div className="mt-4 flex h-48 items-end gap-1 overflow-x-auto pb-1">
                  {data.chart.length ? (
                    data.chart.map((point, idx) => {
                      const height = Math.round((point.value / maxChart) * 100);
                      return (
                        <div
                          key={`${point.label}-${idx}`}
                          className="flex min-w-[30px] flex-1 flex-col items-center justify-end gap-1"
                          title={`${point.label}: ${point.value.toLocaleString("uk-UA")}`}
                        >
                          <div
                            className="w-full max-w-[16px] rounded-t-md bg-[var(--enver-accent)]/85"
                            style={{ height: `${Math.max(8, height)}%` }}
                          />
                          <span className="max-w-full truncate text-[10px] text-[var(--enver-muted)]">
                            {point.label}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-[var(--enver-text-muted)]">
                      Немає даних для графіка.
                    </p>
                  )}
                </div>
              </article>

              <article className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
                  Інсайти
                </p>
                <ul className="mt-3 space-y-2">
                  {data.highlights.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-2 text-sm text-[var(--enver-text)]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] text-[var(--enver-text-muted)]">
                  Оновлено: {new Date(data.generatedAt).toLocaleString("uk-UA")}
                </p>
              </article>
            </section>

            <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                  Деталізація
                </h2>
                <p className="text-[11px] text-[var(--enver-text-muted)]">
                  Діапазон: {RANGE_LABEL[data.range]}
                </p>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-[var(--enver-muted)]">
                    <tr>
                      <th className="px-2 py-2 font-semibold">Показник</th>
                      <th className="px-2 py-2 font-semibold">Значення</th>
                      <th className="px-2 py-2 font-semibold">Деталі</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--enver-border)]">
                        <td className="px-2 py-2.5 text-[var(--enver-text)]">{row.label}</td>
                        <td className="px-2 py-2.5 font-medium text-[var(--enver-text)]">
                          {row.primary}
                        </td>
                        <td className="px-2 py-2.5 text-[var(--enver-text-muted)]">
                          {row.secondary ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
