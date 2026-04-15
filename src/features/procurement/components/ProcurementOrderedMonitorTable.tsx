"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { summarizeOrderedLineMonitor, type OrderedLineMonitorRow } from "../lib/ordered-line-monitor";
import {
  readMonitorPrefs,
  writeMonitorPrefs,
  type QuickFilter,
  type SortMode,
} from "../lib/ordered-monitor-prefs";
import { formatMoneyUa } from "@/features/finance/lib/format-money";

function deadlineLabel(s: OrderedLineMonitorRow["deadlineStatus"]): { text: string; className: string } {
  switch (s) {
    case "overdue":
      return { text: "Прострочено", className: "text-rose-800 bg-rose-100/90 ring-1 ring-rose-200/80" };
    case "soon":
      return { text: "≤7 дн.", className: "text-amber-900 bg-amber-100/90 ring-1 ring-amber-200/80" };
    case "ok":
      return { text: "У строку", className: "text-emerald-900 bg-emerald-100/90 ring-1 ring-emerald-200/80" };
    default:
      return { text: "—", className: "text-slate-600 bg-slate-100/90" };
  }
}

function financeLabel(s: OrderedLineMonitorRow["financeFlag"]): { text: string; className: string } {
  switch (s) {
    case "overrun":
      return { text: "Перевитрата", className: "text-rose-900 bg-rose-50 ring-1 ring-rose-100" };
    case "saving":
      return { text: "Економія", className: "text-emerald-900 bg-emerald-50 ring-1 ring-emerald-100" };
    default:
      return { text: "У межах", className: "text-slate-700 bg-slate-50 ring-1 ring-slate-100" };
  }
}

function formatDays(d: number | null): string | null {
  if (d === null) return null;
  if (d === 0) return "сьогодні";
  if (d < 0) return `${d} дн.`;
  return `+${d} дн.`;
}

function safeFulfillmentPct(row: OrderedLineMonitorRow): number {
  if (typeof row.fulfillmentPct === "number" && !Number.isNaN(row.fulfillmentPct)) {
    return Math.min(100, Math.max(0, row.fulfillmentPct));
  }
  const denom = row.qtyPlanned > 0 ? row.qtyPlanned : row.qtyOrdered > 0 ? row.qtyOrdered : 1;
  return Math.min(100, Math.max(0, Math.round((row.qtyReceived / denom) * 100)));
}

function defaultCrmOrder(a: OrderedLineMonitorRow, b: OrderedLineMonitorRow): number {
  const rank = (x: OrderedLineMonitorRow["deadlineStatus"]) =>
    x === "overdue" ? 0 : x === "soon" ? 1 : x === "ok" ? 2 : 3;
  const ra = rank(a.deadlineStatus);
  const rb = rank(b.deadlineStatus);
  if (ra !== rb) return ra - rb;
  const da = a.neededByDate ?? "";
  const db = b.neededByDate ?? "";
  return da.localeCompare(db);
}

function sortRows(rows: OrderedLineMonitorRow[], mode: SortMode, dir: 1 | -1): OrderedLineMonitorRow[] {
  const list = [...rows];
  switch (mode) {
    case "crm":
      return list.sort(defaultCrmOrder);
    case "days": {
      const big = 100_000;
      return list.sort((a, b) => {
        const av = a.daysUntilDue ?? big;
        const bv = b.daysUntilDue ?? big;
        return (av - bv) * dir;
      });
    }
    case "remaining":
      return list.sort((a, b) => (a.valueRemainingPlanned - b.valueRemainingPlanned) * -dir);
    case "deal":
      return list.sort((a, b) => a.dealTitle.localeCompare(b.dealTitle, "uk") * dir);
    case "fulfill":
      return list.sort(
        (a, b) => (safeFulfillmentPct(a) - safeFulfillmentPct(b)) * dir,
      );
    default:
      return list;
  }
}

function applyQuickFilter(rows: OrderedLineMonitorRow[], f: QuickFilter): OrderedLineMonitorRow[] {
  if (f === "all") return rows;
  return rows.filter((r) => {
    switch (f) {
      case "overdue":
        return r.deadlineStatus === "overdue";
      case "soon":
        return r.deadlineStatus === "soon";
      case "overrun":
        return r.financeFlag === "overrun";
      case "saving":
        return r.financeFlag === "saving";
      case "no_deadline":
        return !r.neededByDate && r.qtyRemaining > 0;
      default:
        return true;
    }
  });
}

function csvEscape(s: string): string {
  const t = s.replace(/"/g, '""');
  return `"${t}"`;
}

function downloadMonitorCsv(rows: OrderedLineMonitorRow[], filename: string) {
  const header = [
    "Угода",
    "ID заявки",
    "Позиція",
    "Потрібно до",
    "Дні до дедлайну",
    "Строк",
    "Фінанси",
    "Виконання %",
    "План грн",
    "Замовлено грн",
    "Отримано грн",
    "Залишок грн",
    "Залишок од",
    "Дельта од грн",
  ];
  const lines = rows.map((r) =>
    [
      r.dealTitle,
      r.requestId,
      r.itemName,
      r.neededByDate ?? "",
      r.daysUntilDue === null ? "" : String(r.daysUntilDue),
      r.deadlineStatus,
      r.financeFlag,
      String(safeFulfillmentPct(r)),
      String(Math.round(r.plannedValue)),
      String(Math.round(r.orderedValue)),
      String(Math.round(r.receivedValue)),
      String(Math.round(r.valueRemainingPlanned)),
      String(r.qtyRemaining),
      String(r.unitPriceDelta),
    ].map((c) => csvEscape(c)),
  );
  const bom = "\uFEFF";
  const body = [header.map(csvEscape).join(";"), ...lines.map((line) => line.join(";"))].join("\r\n");
  const blob = new Blob([bom + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  rows: OrderedLineMonitorRow[];
  maxRows?: number;
  compact?: boolean;
  emptyHint?: string;
  /** Панель KPI над таблицею. */
  showSummary?: boolean;
  /** Пошук, сортування, CSV. */
  showToolbar?: boolean;
  /** Прокрутка лише таблиці (KPI та тулбар лишаються на екрані), напр. `max-h-[min(480px,60vh)] overflow-y-auto`. */
  tableScrollClassName?: string;
  /** Зберігати пошук, сортування та швидкі фільтри в localStorage. */
  persistPrefs?: boolean;
  /** Окремий ключ для огляду / hub, щоб налаштування не змішувались. */
  prefsScope?: "default" | "hub";
};

export function ProcurementOrderedMonitorTable({
  rows,
  maxRows = 100,
  compact = false,
  emptyHint = "Немає відкритих позицій для моніторингу (план = факт по кількості або заявки закриті).",
  showSummary = true,
  showToolbar = true,
  tableScrollClassName,
  persistPrefs = true,
  prefsScope = "default",
}: Props) {
  const storageScope = prefsScope === "hub" ? "hub" : "default";
  const [q, setQ] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("crm");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  useEffect(() => {
    if (!persistPrefs) {
      const timer = window.setTimeout(() => setPrefsHydrated(true), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      const p = readMonitorPrefs(storageScope);
      setQ(p.q);
      setSortMode(p.sortMode);
      setSortDir(p.sortDir);
      setQuickFilter(p.quickFilter);
      setPrefsHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [persistPrefs, storageScope]);

  useEffect(() => {
    if (!persistPrefs || !prefsHydrated) return;
    writeMonitorPrefs(storageScope, { q, sortMode, sortDir, quickFilter });
  }, [persistPrefs, prefsHydrated, storageScope, q, sortMode, sortDir, quickFilter]);

  const searchFiltered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.dealTitle.toLowerCase().includes(t) ||
        r.itemName.toLowerCase().includes(t) ||
        r.requestId.toLowerCase().includes(t),
    );
  }, [rows, q]);

  const filtered = useMemo(
    () => applyQuickFilter(searchFiltered, quickFilter),
    [searchFiltered, quickFilter],
  );

  const sorted = useMemo(() => sortRows(filtered, sortMode, sortDir), [filtered, sortMode, sortDir]);

  const slice = sorted.slice(0, maxRows);
  const summary = useMemo(() => summarizeOrderedLineMonitor(filtered), [filtered]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const onSearchKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setQ("");
      searchInputRef.current?.blur();
    }
  }, []);

  const quickCounts = useMemo(() => {
    const base = searchFiltered;
    return {
      all: base.length,
      overdue: base.filter((r) => r.deadlineStatus === "overdue").length,
      soon: base.filter((r) => r.deadlineStatus === "soon").length,
      overrun: base.filter((r) => r.financeFlag === "overrun").length,
      saving: base.filter((r) => r.financeFlag === "saving").length,
      no_deadline: base.filter((r) => !r.neededByDate && r.qtyRemaining > 0).length,
    };
  }, [searchFiltered]);

  const QUICK_CHIPS: Array<{ id: QuickFilter; label: string; count: number }> = [
    { id: "all", label: "Усі", count: quickCounts.all },
    { id: "overdue", label: "Прострочено", count: quickCounts.overdue },
    { id: "soon", label: "≤7 дн.", count: quickCounts.soon },
    { id: "overrun", label: "Перевитрата", count: quickCounts.overrun },
    { id: "saving", label: "Економія", count: quickCounts.saving },
    { id: "no_deadline", label: "Без дати", count: quickCounts.no_deadline },
  ];

  const toggleDir = useCallback(() => setSortDir((d) => (d === 1 ? -1 : 1)), []);

  const cell = compact ? "px-2 py-1.5" : "px-2.5 py-2";
  const textSize = compact ? "text-xs" : "text-sm";

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
        <p className="text-sm font-medium text-slate-700">Немає даних</p>
        <p className="mt-1 text-xs text-slate-500">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showSummary ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Рядків" value={String(summary.totalRows)} tone="slate" />
          <Kpi label="Прострочено" value={String(summary.overdueCount)} tone="rose" highlight={summary.overdueCount > 0} />
          <Kpi label="≤7 днів" value={String(summary.soonCount)} tone="amber" highlight={summary.soonCount > 0} />
          <Kpi
            label="Залишок (усі)"
            value={`${formatMoneyUa(Math.round(summary.totalRemainingUah))} ₴`}
            tone="slate"
          />
          <Kpi
            label="У ризику (строк)"
            value={`${formatMoneyUa(Math.round(summary.atRiskRemainingUah))} ₴`}
            tone="orange"
            highlight={summary.atRiskRemainingUah > 0}
          />
          <Kpi label="Сер. викон. %" value={`${summary.avgFulfillmentPct}%`} tone="emerald" />
        </div>
      ) : null}

      {showToolbar ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input
              ref={searchInputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Пошук: угода, позиція, ID заявки… (Esc — скинути)"
              className="min-w-[200px] max-w-md flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:ring-2"
              aria-label="Пошук по моніторингу позицій"
              autoComplete="off"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Скинути пошук
              </button>
            ) : null}
            {q || quickFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setQuickFilter("all");
                }}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Усі фільтри
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="whitespace-nowrap">Сортування</span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 shadow-sm"
              >
                <option value="crm">За ризиком (прострочення → дата)</option>
                <option value="days">За днями до дедлайну</option>
                <option value="remaining">За залишком бюджету</option>
                <option value="deal">За угодою (А-Я)</option>
                <option value="fulfill">За % виконання</option>
              </select>
            </label>
            {sortMode !== "crm" ? (
              <button
                type="button"
                onClick={toggleDir}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                title="Напрям сортування"
              >
                {sortDir === 1 ? "↑ Зростання" : "↓ Спадання"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                downloadMonitorCsv(
                  sorted,
                  `procurement-positions-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Експорт CSV
            </button>
          </div>
        </div>
      ) : null}

      {showToolbar ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Швидкі фільтри">
          {QUICK_CHIPS.map((chip) => {
            const active = quickFilter === chip.id;
            const dim = chip.count === 0 && chip.id !== "all";
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setQuickFilter(chip.id)}
                title={dim ? "У поточному пошуку таких рядків немає — можна перемкнути для перевірки" : undefined}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : dim
                      ? "bg-slate-50 text-slate-400 ring-1 ring-slate-100 hover:bg-slate-100"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {chip.label}
                <span className="ml-1 tabular-nums opacity-80">({chip.count})</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          {searchFiltered.length === 0 && q.trim() ? (
            <>
              Нічого не знайдено за запитом «{q}». Спробуйте інший текст або натисніть Esc.
            </>
          ) : (
            <>
              У поточному швидкому фільтрі немає рядків (після пошуку залишилось {searchFiltered.length}). Оберіть інший
              фільтр або «Усі».
            </>
          )}
        </p>
      ) : (
        <div
          className={`overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.04] ${textSize} ${tableScrollClassName ?? ""}`}
        >
          <table className="min-w-[1040px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gradient-to-b from-slate-50 to-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-[0_1px_0_0_rgb(226_232_240)]">
              <tr>
                <th className={cell}>Угода</th>
                <th className={`${cell} w-10`} aria-label="Робочий простір" />
                <th className={cell}>Заявка</th>
                <th className={cell}>Позиція</th>
                <th className={cell}>Потрібно до</th>
                <th className={cell}>Строк / дні</th>
                <th className={cell}>Фін.</th>
                <th className={`${cell} w-24`}>%</th>
                <th className={`${cell} tabular-nums`}>План ₴</th>
                <th className={`${cell} tabular-nums`}>Замовл. ₴</th>
                <th className={`${cell} tabular-nums`}>Отримано ₴</th>
                <th className={`${cell} tabular-nums`}>Залишок ₴</th>
                <th className={`${cell} tabular-nums`}>Од.</th>
                <th className={`${cell} tabular-nums`}>Δ од. ₴</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row, idx) => {
                const d = deadlineLabel(row.deadlineStatus);
                const f = financeLabel(row.financeFlag);
                const days = formatDays(row.daysUntilDue);
                const zebra = idx % 2 === 0 ? "bg-white" : "bg-slate-50/40";
                return (
                  <tr
                    key={row.rowKey}
                    className={`border-t border-slate-100 transition-colors hover:bg-sky-50/50 ${zebra}`}
                  >
                    <td className={`${cell} max-w-[200px] font-medium text-[var(--enver-text)]`}>
                      <Link
                        href={`/crm/procurement/${row.dealId}`}
                        className="line-clamp-2 text-sky-800 underline-offset-2 hover:text-sky-950 hover:underline"
                      >
                        {row.dealTitle}
                      </Link>
                    </td>
                    <td className={`${cell} text-center`}>
                      <Link
                        href={`/deals/${row.dealId}/workspace`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold text-slate-500 ring-1 ring-slate-200/80 hover:bg-white hover:text-sky-800 hover:ring-sky-200"
                        title="Робочий простір угоди"
                      >
                        WS
                      </Link>
                    </td>
                    <td className={`${cell} font-mono text-[11px] text-slate-600`}>
                      <Link
                        href={`/crm/procurement/${row.dealId}`}
                        className="text-sky-800 underline-offset-2 hover:underline"
                      >
                        {row.requestId.slice(0, 10)}…
                      </Link>
                    </td>
                    <td className={`${cell} max-w-[200px]`}>
                      <span className="line-clamp-2 text-slate-800" title={row.itemName}>
                        {row.itemName}
                      </span>
                    </td>
                    <td className={`${cell} tabular-nums text-slate-700`}>{row.neededByDate ?? "—"}</td>
                    <td className={cell}>
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex w-fit rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${d.className}`}>
                          {d.text}
                        </span>
                        {days ? <span className="text-[10px] tabular-nums text-slate-500">{days}</span> : null}
                      </div>
                    </td>
                    <td className={cell}>
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${f.className}`}>
                        {f.text}
                      </span>
                    </td>
                    <td className={cell}>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                            style={{ width: `${safeFulfillmentPct(row)}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-[11px] text-slate-600">{safeFulfillmentPct(row)}%</span>
                      </div>
                    </td>
                    <td className={`${cell} tabular-nums text-slate-800`}>
                      {formatMoneyUa(Math.round(row.plannedValue))}
                    </td>
                    <td className={`${cell} tabular-nums text-slate-800`}>
                      {formatMoneyUa(Math.round(row.orderedValue))}
                    </td>
                    <td className={`${cell} tabular-nums text-slate-800`}>
                      {formatMoneyUa(Math.round(row.receivedValue))}
                    </td>
                    <td className={`${cell} tabular-nums font-semibold text-slate-900`}>
                      {formatMoneyUa(Math.round(row.valueRemainingPlanned))}
                    </td>
                    <td className={`${cell} tabular-nums text-slate-700`}>
                      {row.qtyRemaining % 1 === 0 ? row.qtyRemaining : row.qtyRemaining.toFixed(1)}
                    </td>
                    <td
                      className={`${cell} tabular-nums ${
                        row.unitPriceDelta > 0
                          ? "text-rose-700"
                          : row.unitPriceDelta < 0
                            ? "text-emerald-700"
                            : "text-slate-500"
                      }`}
                    >
                      {row.unitPriceDelta === 0 ? "—" : formatMoneyUa(row.unitPriceDelta, 2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length > maxRows ? (
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
              Показано {maxRows} з {sorted.length} рядків після фільтрів. Звузьте пошук або збільшіть ліміт у коді.
            </p>
          ) : (
            <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
              {filtered.length === rows.length && searchFiltered.length === rows.length
                ? `Усього ${filtered.length} поз.`
                : `Показано ${filtered.length} з ${searchFiltered.length} після фільтрів (база ${rows.length}).`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  tone: "slate" | "rose" | "amber" | "orange" | "emerald";
  highlight?: boolean;
}) {
  const ring =
    tone === "rose"
      ? "ring-rose-100"
      : tone === "amber"
        ? "ring-amber-100"
        : tone === "orange"
          ? "ring-orange-100"
          : tone === "emerald"
            ? "ring-emerald-100"
            : "ring-slate-100";
  const bg =
    tone === "rose"
      ? "bg-rose-50/90"
      : tone === "amber"
        ? "bg-amber-50/90"
        : tone === "orange"
          ? "bg-orange-50/90"
          : tone === "emerald"
            ? "bg-emerald-50/90"
            : "bg-slate-50/90";
  return (
    <div
      className={`rounded-xl border border-white/80 px-3 py-2 shadow-sm shadow-slate-900/5 ring-1 ${ring} ${bg} ${
        highlight ? "ring-2 ring-offset-1 ring-amber-400/80" : ""
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
