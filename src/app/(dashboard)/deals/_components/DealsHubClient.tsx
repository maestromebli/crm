"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import {
  Download,
  GripVertical,
  LayoutGrid,
  Rows3,
  Search,
  Sparkles,
  Table2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DealHubFilters,
  DealHubSavedViewDTO,
  DealHubSortKey,
  SavedViewChipId,
} from "../../../../features/deal-hub/deal-hub-filters";
import { patchDealStageById } from "../../../../features/deal-workspace/use-deal-mutation-actions";
import { cn } from "../../../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KanbanEmptyColumn } from "@/components/shared/KanbanEmptyColumn";
import type { DealBoardStage } from "../../../../features/deal-workspace/queries";
import type { DealHubRow } from "./deal-hub-row";
import { DealsKpiStrip } from "./DealsKpiStrip";
import { DealsSavedViewsBar } from "./DealsSavedViewsBar";

export type { DealHubRow } from "./deal-hub-row";

const DealsSmartInsights = dynamic(
  () => import("./DealsSmartInsights").then((m) => m.DealsSmartInsights),
  {
    loading: () => (
      <div className="h-24 animate-pulse rounded-2xl bg-[var(--enver-surface)]" />
    ),
  },
);

const VIEWS: Array<{ id: SavedViewChipId; label: string }> = [
  { id: "all_open", label: "Мої активні" },
  { id: "no_next", label: "Без наступного кроку" },
  { id: "overdue_next", label: "Прострочений follow-up" },
  { id: "wait_pay", label: "Очікуємо оплату" },
  { id: "no_est", label: "Без смети" },
  { id: "no_contract", label: "Без договору" },
  { id: "stale", label: "Застійні" },
];

const STALE_MS = 14 * 86_400_000;

const DEAL_DND_MIME = "application/x-enver-deal-id";

const SORT_OPTIONS: Array<{ id: DealHubSortKey; label: string }> = [
  { id: "updated_desc", label: "Оновлення ↓" },
  { id: "value_desc", label: "Сума ↓" },
  { id: "client_asc", label: "Клієнт А→Я" },
  { id: "stage_asc", label: "Стадія А→Я" },
];
const INITIAL_TABLE_ROWS = 60;
const TABLE_ROWS_STEP = 40;
const INITIAL_BOARD_ROWS = 24;
const BOARD_ROWS_STEP = 16;
const BOARD_SCROLL_STORAGE_KEY = "enver:deals-board-scroll";

function filterRows(view: SavedViewChipId, rows: DealHubRow[]): DealHubRow[] {
  const now = Date.now();
  return rows.filter((r) => {
    if (r.status !== "OPEN") return false;
    if (view === "all_open") return true;
    const hasNext =
      Boolean(r.nextStepLabel?.trim()) && Boolean(r.nextActionAt);
    const nextAt = r.nextActionAt ? new Date(r.nextActionAt).getTime() : NaN;
    const nextOverdue =
      !Number.isNaN(nextAt) && nextAt < now && hasNext;

    if (view === "no_next") return !hasNext;
    if (view === "overdue_next") return nextOverdue;
    if (view === "wait_pay") {
      if (r.paymentShort === "—") return false;
      if (r.paymentShort.includes("✓")) return false;
      const m = /^(\d+)\/(\d+)/.exec(r.paymentShort);
      if (m) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        return a < b;
      }
      return false;
    }
    if (view === "no_est") return r.estimatesCount === 0;
    if (view === "no_contract") return !r.hasContract;
    if (view === "stale") {
      const u = new Date(r.updatedAt).getTime();
      return now - u >= STALE_MS;
    }
    return true;
  });
}

function applySearch(rows: DealHubRow[], q: string): DealHubRow[] {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter(
    (r) =>
      r.clientName.toLowerCase().includes(s) ||
      r.title.toLowerCase().includes(s) ||
      r.stageName.toLowerCase().includes(s) ||
      r.pipelineName.toLowerCase().includes(s) ||
      (r.ownerName ?? "").toLowerCase().includes(s) ||
      r.paymentShort.toLowerCase().includes(s),
  );
}

function sortRows(rows: DealHubRow[], key: DealHubSortKey): DealHubRow[] {
  const copy = [...rows];
  switch (key) {
    case "updated_desc":
      return copy.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    case "value_desc":
      return copy.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    case "client_asc":
      return copy.sort((a, b) =>
        a.clientName.localeCompare(b.clientName, "uk"),
      );
    case "stage_asc":
      return copy.sort((a, b) => {
        const o = a.stageSortOrder - b.stageSortOrder;
        if (o !== 0) return o;
        return a.stageName.localeCompare(b.stageName, "uk");
      });
    default:
      return copy;
  }
}

function escapeCsvCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function buildCsv(rows: DealHubRow[]): string {
  const headers = [
    "Воронка",
    "Клієнт",
    "Замовлення",
    "Стадія",
    "Відповідальний",
    "Сума",
    "Валюта",
    "Наступний крок",
    "Дата кроку",
    "Оновлено",
    "Смета",
    "Оплата",
    "Ризик",
    "Статус",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const line = [
      r.pipelineName,
      r.clientName,
      r.title,
      r.stageName,
      r.ownerName ?? "",
      r.value != null ? String(r.value) : "",
      r.currency ?? "",
      r.nextStepLabel ?? "",
      r.nextActionAt
        ? format(new Date(r.nextActionAt), "yyyy-MM-dd HH:mm")
        : "",
      format(new Date(r.updatedAt), "yyyy-MM-dd HH:mm"),
      String(r.estimatesCount),
      r.paymentShort,
      r.warningBadge ?? "",
      r.status,
    ].map(escapeCsvCell);
    lines.push(line.join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function downloadDealsCsv(rows: DealHubRow[], filename: string) {
  const blob = new Blob(["\ufeff", buildCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  rows: DealHubRow[];
  initialLayout?: "table" | "board";
  serverFiltered?: boolean;
  kpiCountLabel?: string;
  /** Усі стадії воронки(ок) з БД — канбан показує порожні колонки. */
  boardStages?: DealBoardStage[];
  /** Збережені вигляди з БД (користувацькі пресети). */
  savedViewsInitial?: DealHubSavedViewDTO[];
  /** Хибний на сторінках з жорстким серверним фільтром (won/lost/архів). */
  savedViewsEnabled?: boolean;
};

export function DealsHubClient({
  rows,
  initialLayout = "table",
  serverFiltered = false,
  kpiCountLabel = "Після фільтрів",
  boardStages = [],
  savedViewsInitial = [],
  savedViewsEnabled = true,
}: Props) {
  const router = useRouter();
  const [savedView, setSavedView] = useState<SavedViewChipId>("all_open");
  const [layout, setLayout] = useState<"table" | "board">(initialLayout);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<DealHubSortKey>("updated_desc");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [density, setDensity] = useState<"compact" | "comfortable">(
    "comfortable",
  );
  const [showInsights, setShowInsights] = useState(true);
  const [visibleTableRows, setVisibleTableRows] = useState(INITIAL_TABLE_ROWS);
  const [visibleBoardRows, setVisibleBoardRows] = useState<
    Record<string, number>
  >({});
  const boardScrollByStageRef = useRef<Record<string, number>>({});

  const persistBoardScrollSnapshot = useCallback(() => {
    try {
      window.sessionStorage.setItem(
        BOARD_SCROLL_STORAGE_KEY,
        JSON.stringify(boardScrollByStageRef.current),
      );
    } catch {
      // sessionStorage can be unavailable in strict privacy mode.
    }
  }, []);

  const updateBoardScroll = useCallback(
    (stageId: string, scrollTop: number) => {
      boardScrollByStageRef.current = {
        ...boardScrollByStageRef.current,
        [stageId]: scrollTop,
      };
      persistBoardScrollSnapshot();
    },
    [persistBoardScrollSnapshot],
  );

  const restoreBoardScroll = useCallback((stageId: string, node: HTMLUListElement) => {
    const top = boardScrollByStageRef.current[stageId] ?? 0;
    if (top > 0) {
      node.scrollTop = top;
    }
  }, []);

  const [savedViews, setSavedViews] =
    useState<DealHubSavedViewDTO[]>(savedViewsInitial);
  useEffect(() => {
    setSavedViews(savedViewsInitial);
  }, [savedViewsInitial]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(BOARD_SCROLL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, number>;
      if (!parsed || typeof parsed !== "object") return;
      boardScrollByStageRef.current = parsed;
    } catch {
      boardScrollByStageRef.current = {};
    }
  }, []);

  /** Локальне оновлення стадії після успішного drag-and-drop до приходу refresh. */
  const [stageOverrides, setStageOverrides] = useState<
    Record<
      string,
      Pick<DealHubRow, "stageId" | "stageName" | "stageSortOrder">
    >
  >({});
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [movingDealId, setMovingDealId] = useState<string | null>(null);
  const [dndBanner, setDndBanner] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    setStageOverrides({});
  }, [rows]);

  useEffect(() => {
    if (!dndBanner) return;
    const t = window.setTimeout(() => setDndBanner(null), 7000);
    return () => window.clearTimeout(t);
  }, [dndBanner]);

  const mergedRows = useMemo(() => {
    return rows.map((r) => {
      const o = stageOverrides[r.id];
      return o ? { ...r, ...o } : r;
    });
  }, [rows, stageOverrides]);

  const afterSavedView = useMemo(() => {
    if (serverFiltered) return mergedRows;
    return filterRows(savedView, mergedRows);
  }, [mergedRows, savedView, serverFiltered]);

  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of afterSavedView) {
      m.set(r.ownerId, r.ownerName ?? r.ownerId);
    }
    return [...m.entries()].sort((a, b) =>
      (a[1] ?? "").localeCompare(b[1] ?? "", "uk"),
    );
  }, [afterSavedView]);

  const afterOwner = useMemo(() => {
    if (ownerFilter === "all") return afterSavedView;
    return afterSavedView.filter((r) => r.ownerId === ownerFilter);
  }, [afterSavedView, ownerFilter]);

  const displayRows = useMemo(() => {
    return sortRows(applySearch(afterOwner, search), sortKey);
  }, [afterOwner, search, sortKey]);

  const showPipelineColumn = useMemo(() => {
    const ids = new Set(displayRows.map((r) => r.pipelineId));
    return ids.size > 1;
  }, [displayRows]);

  const boardGroups = useMemo(() => {
    if (boardStages.length > 0) {
      const m = new Map<string, DealHubRow[]>();
      for (const r of displayRows) {
        if (!m.has(r.stageId)) m.set(r.stageId, []);
        m.get(r.stageId)!.push(r);
      }
      return boardStages.map((st) => ({
        stageId: st.id,
        stageName: st.name,
        stageSortOrder: st.sortOrder,
        pipelineId: st.pipelineId,
        pipelineName: st.pipelineName,
        rows: m.get(st.id) ?? [],
      }));
    }
    const legacy = new Map<
      string,
      { label: string; sortOrder: number; list: DealHubRow[] }
    >();
    for (const r of displayRows) {
      const cur = legacy.get(r.stageId);
      if (!cur) {
        legacy.set(r.stageId, {
          label: r.stageName,
          sortOrder: r.stageSortOrder,
          list: [r],
        });
      } else {
        cur.list.push(r);
      }
    }
    return [...legacy.entries()]
      .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
      .map(([id, v]) => ({
        stageId: id,
        stageName: v.label,
        stageSortOrder: v.sortOrder,
        pipelineId: v.list[0]?.pipelineId ?? "",
        pipelineName: v.list[0]?.pipelineName ?? "",
        rows: v.list,
      }));
  }, [displayRows, boardStages]);

  useEffect(() => {
    setVisibleTableRows(INITIAL_TABLE_ROWS);
  }, [search, sortKey, ownerFilter, savedView, serverFiltered, rows]);

  useEffect(() => {
    setVisibleBoardRows((prev) => {
      const next: Record<string, number> = {};
      for (const group of boardGroups) {
        next[group.stageId] = prev[group.stageId] ?? INITIAL_BOARD_ROWS;
      }
      return next;
    });
  }, [boardGroups]);

  const showPipelineOnBoard = useMemo(() => {
    const ids = new Set(boardGroups.map((g) => g.pipelineId).filter(Boolean));
    return ids.size > 1;
  }, [boardGroups]);

  const handleExport = useCallback(() => {
    const stamp = format(new Date(), "yyyy-MM-dd_HH-mm");
    downloadDealsCsv(displayRows, `enver-deals_${stamp}.csv`);
  }, [displayRows]);

  const cellY = density === "compact" ? "py-1.5" : "py-2.5";
  const headY = density === "compact" ? "py-2" : "py-2.5";

  const openWorkspace = useCallback(
    (id: string) => {
      router.push(`/deals/${id}/workspace`);
    },
    [router],
  );

  const applyStageFromBoard = useCallback(
    async (
      dealId: string,
      target: {
        stageId: string;
        stageName: string;
        stageSortOrder: number;
        pipelineId: string;
      },
    ) => {
      const deal = mergedRows.find((r) => r.id === dealId);
      if (!deal) return;
      if (deal.status !== "OPEN") {
        setDndBanner({
          kind: "err",
          text: "Закриті замовлення не переносять на дошці. Відкрийте картку замовлення для змін.",
        });
        return;
      }
      if (deal.pipelineId !== target.pipelineId) {
        setDndBanner({
          kind: "err",
          text: "Перетягуйте лише в межах однієї воронки.",
        });
        return;
      }
      if (deal.stageId === target.stageId) return;

      setMovingDealId(dealId);
      setDndBanner(null);

      setStageOverrides((prev) => ({
        ...prev,
        [dealId]: {
          stageId: target.stageId,
          stageName: target.stageName,
          stageSortOrder: target.stageSortOrder,
        },
      }));

      try {
        const j = await patchDealStageById(dealId, target.stageId);
        setDndBanner({
          kind: "ok",
          text: `Стадію оновлено: ${j.stageName ?? target.stageName}`,
        });
        router.refresh();
      } catch (e) {
        setStageOverrides((prev) => {
          const next = { ...prev };
          delete next[dealId];
          return next;
        });
        const msg = e instanceof Error ? e.message : "Мережева помилка. Спробуйте ще раз.";
        setDndBanner({
          kind: "err",
          text: msg,
        });
      } finally {
        setMovingDealId(null);
      }
    },
    [mergedRows, router],
  );

  const getFiltersSnapshot = useCallback((): DealHubFilters => {
    return {
      savedView,
      sortKey,
      ownerFilter,
      layout,
      showInsights,
      search: search.trim() || undefined,
    };
  }, [savedView, sortKey, ownerFilter, layout, showInsights, search]);

  const applySavedFilters = useCallback((f: DealHubFilters) => {
    setSavedView(f.savedView);
    setSortKey(f.sortKey);
    setOwnerFilter(f.ownerFilter);
    setLayout(f.layout);
    setShowInsights(f.showInsights);
    setSearch(f.search ?? "");
  }, []);

  return (
    <div className="space-y-4">
      {showInsights ? <DealsSmartInsights rows={displayRows} /> : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setLayout("table")}
                  className={cn(
                    "enver-cta enver-cta-xs",
                    layout === "table"
                      ? "enver-cta-primary"
                      : "enver-cta-ghost",
                  )}
                >
                  <Table2 className="h-3.5 w-3.5" aria-hidden />
                  Таблиця
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[16rem]">
                Список замовлень з колонками — сортування та експорт
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setLayout("board")}
                  className={cn(
                    "enver-cta enver-cta-xs",
                    layout === "board"
                      ? "enver-cta-primary"
                      : "enver-cta-ghost",
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                  Дошка
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[16rem]">
                Kanban по стадіях воронки з перетягуванням карток
              </TooltipContent>
            </Tooltip>
          </div>

          <span className="hidden h-4 w-px bg-[var(--enver-border)] sm:inline-block" />

          <div className="flex flex-wrap gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() =>
                    setDensity((d) =>
                      d === "compact" ? "comfortable" : "compact",
                    )
                  }
                  className="enver-cta enver-cta-xs enver-cta-secondary"
                >
                  <Rows3 className="h-3 w-3" aria-hidden />
                  {density === "compact" ? "Компактно" : "Зручно"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Щільність рядків у таблиці</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowInsights((s) => !s)}
                  className={cn(
                    "enver-cta enver-cta-xs",
                    showInsights
                      ? "enver-cta-primary"
                      : "enver-cta-secondary",
                  )}
                >
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Підказки
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[16rem]">
                Панель AI-інсайтів над списком (ризики, наступні кроки)
              </TooltipContent>
            </Tooltip>
          </div>

          <span className="hidden h-4 w-px bg-[var(--enver-border)] sm:inline-block" />

          {!serverFiltered ? (
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSavedView(v.id)}
                  className={cn(
                    "enver-cta enver-cta-xs enver-cta-pill whitespace-nowrap",
                    savedView === v.id
                      ? "enver-cta-primary"
                      : "enver-cta-secondary",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[var(--enver-muted)]">
              Серверний фільтр — збережені вигляди вимкнено.
            </p>
          )}

          <p className="w-full text-[10px] text-[var(--enver-muted)] sm:ml-auto sm:w-auto">
            Показано: {displayRows.length}
            {!serverFiltered
              ? ` з ${afterOwner.length} (після збереженого)`
              : ` з ${mergedRows.length}`}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--enver-border)] pt-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--enver-muted)]"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук: клієнт, замовлення, стадія, воронка, менеджер…"
              className="w-full rounded-xl border border-[var(--enver-border)] bg-[var(--enver-input-bg)] py-2 pl-8 pr-3 text-xs text-[var(--enver-text)] outline-none placeholder:text-[var(--enver-muted)] focus:border-[var(--enver-accent)] focus:ring-2 focus:ring-[var(--enver-accent-ring)]"
              aria-label="Пошук у списку"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ownerOptions.length > 1 ? (
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--enver-muted)]">
                Менеджер
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="max-w-[160px] rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-1.5 text-[11px] font-medium text-[var(--enver-text)]"
                >
                  <option value="all">Усі</option>
                  {ownerOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--enver-muted)]">
              Сортування
              <select
                value={sortKey}
                onChange={(e) =>
                  setSortKey(e.target.value as DealHubSortKey)
                }
                className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-1.5 text-[11px] font-medium text-[var(--enver-text)]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={displayRows.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-2 text-[11px] font-semibold text-[var(--enver-text)] shadow-sm transition hover:border-[var(--enver-border-strong)] hover:bg-[var(--enver-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  CSV
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Експорт поточного списку у CSV (UTF‑8)</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {savedViewsEnabled && !serverFiltered ? (
        <DealsSavedViewsBar
          views={savedViews}
          getSnapshot={getFiltersSnapshot}
          onApply={applySavedFilters}
          onMutated={() => router.refresh()}
        />
      ) : null}

      <DealsKpiStrip rows={displayRows} countLabel={kpiCountLabel} />

      {dndBanner ? (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px] leading-snug shadow-sm",
            dndBanner.kind === "ok"
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-950"
              : "border-[var(--enver-danger)]/35 bg-[var(--enver-danger-soft)] text-[var(--enver-text)]",
          )}
        >
          <span
            className={cn(
              "mt-0.5 h-2 w-2 shrink-0 rounded-full",
              dndBanner.kind === "ok" ? "bg-emerald-500" : "bg-[var(--enver-danger)]",
            )}
          />
          <p>{dndBanner.text}</p>
        </div>
      ) : null}

      {layout === "table" ? (
        <div className="overflow-hidden rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)]">
          <div
            className="max-h-[min(70vh,1200px)] overflow-auto"
            onScroll={(event) => {
              const el = event.currentTarget;
              const nearBottom =
                el.scrollTop + el.clientHeight >= el.scrollHeight - 220;
              if (!nearBottom) return;
              setVisibleTableRows((prev) =>
                Math.min(displayRows.length, prev + TABLE_ROWS_STEP),
              );
            }}
          >
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-[var(--enver-border)] bg-[var(--enver-surface)]/95 text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)] backdrop-blur-sm">
                <tr>
                  {showPipelineColumn ? (
                    <th className={cn("px-3", headY)}>Воронка</th>
                  ) : null}
                  <th className={cn("px-3", headY)}>Клієнт / замовлення</th>
                  <th className={cn("px-3", headY)}>Стадія</th>
                  <th className={cn("px-3", headY)}>Відповідальний</th>
                  <th className={cn("px-3", headY)}>Сума</th>
                  <th className={cn("px-3", headY)}>Наступний крок</th>
                  <th className={cn("px-3", headY)}>Дата кроку</th>
                  <th className={cn("px-3", headY)}>Активність</th>
                  <th className={cn("px-3", headY)}>Смета</th>
                  <th className={cn("px-3", headY)}>Оплата</th>
                  <th className={cn("px-3", headY)}>Ризик</th>
                  <th className={cn("px-3 text-right", headY)}>Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--enver-border)]">
                {displayRows.slice(0, visibleTableRows).map((r) => (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openWorkspace(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openWorkspace(r.id);
                      }
                    }}
                    className="cursor-pointer hover:bg-[var(--enver-hover)]/85"
                  >
                    {showPipelineColumn ? (
                      <td
                        className={cn(
                          "max-w-[120px] truncate px-3 text-[var(--enver-text-muted)]",
                          cellY,
                        )}
                        title={r.pipelineName}
                      >
                        {r.pipelineName}
                      </td>
                    ) : null}
                    <td className={cn("px-3", cellY)}>
                      <p className="font-semibold text-[var(--enver-text)]">
                        {r.clientName}
                      </p>
                      <p className="text-[11px] text-[var(--enver-muted)]">
                        {r.title}
                      </p>
                    </td>
                    <td className={cn("px-3 text-[var(--enver-text-muted)]", cellY)}>
                      {r.stageName}
                    </td>
                    <td className={cn("px-3 text-[var(--enver-text-muted)]", cellY)}>
                      {r.ownerName}
                    </td>
                    <td className={cn("px-3 text-[var(--enver-text-muted)]", cellY)}>
                      {r.value != null
                        ? `${r.value.toLocaleString("uk-UA")} ${r.currency ?? ""}`
                        : "—"}
                    </td>
                    <td className={cn("max-w-[140px] px-3 text-[var(--enver-text)]", cellY)}>
                      {r.nextStepLabel?.trim() || (
                        <span className="text-[var(--enver-danger)]">
                          не задано
                        </span>
                      )}
                    </td>
                    <td className={cn("whitespace-nowrap px-3 text-[var(--enver-text-muted)]", cellY)}>
                      {r.nextActionAt
                        ? format(new Date(r.nextActionAt), "d MMM HH:mm", {
                            locale: uk,
                          })
                        : "—"}
                    </td>
                    <td className={cn("whitespace-nowrap px-3 text-[var(--enver-muted)]", cellY)}>
                      {format(new Date(r.updatedAt), "d MMM", { locale: uk })}
                    </td>
                    <td className={cn("px-3 text-[var(--enver-text-muted)]", cellY)}>
                      {r.estimatesCount > 0 ? `✓ ${r.estimatesCount}` : "—"}
                    </td>
                    <td className={cn("px-3 text-[var(--enver-text-muted)]", cellY)}>
                      {r.paymentShort}
                    </td>
                    <td className={cn("px-3", cellY)}>
                      {r.warningBadge === "critical" ? (
                        <span className="rounded-full border border-[var(--enver-danger)]/30 bg-[var(--enver-danger-soft)]/80 px-2 py-0.5 text-[10px] font-medium text-[var(--enver-danger)]">
                          Критично
                        </span>
                      ) : r.warningBadge === "warning" ? (
                        <span className="rounded-full border border-[var(--enver-warning)]/30 bg-[var(--enver-warning-soft)]/80 px-2 py-0.5 text-[10px] font-medium text-[var(--enver-warning)]">
                          Увага
                        </span>
                      ) : (
                        <span className="text-[var(--enver-muted)]">—</span>
                      )}
                    </td>
                    <td
                      className={cn("px-3 text-right", cellY)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link
                          href={`/deals/${r.id}/workspace`}
                          className="enver-cta enver-cta-xs enver-cta-primary enver-cta-pill"
                        >
                          Відкрити
                        </Link>
                        {r.nextActionAt ? (
                          <Link
                            href={`/deals/${r.id}/workspace`}
                            className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-1 text-[10px] font-medium text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)]"
                            title="Перенести крок у робочому місці"
                          >
                            Крок
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {displayRows.length > visibleTableRows ? (
                  <tr>
                    <td
                      colSpan={showPipelineColumn ? 12 : 11}
                      className="px-3 py-2 text-center text-[11px] text-[var(--enver-muted)]"
                    >
                      Показано {visibleTableRows} з {displayRows.length}. Прокрутіть
                      нижче для підвантаження.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-surface)]/60 px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-[var(--enver-text-muted)]">
              <span className="font-semibold text-[var(--enver-text)]">
                Перетягніть картку за іконку ⋮
              </span>{" "}
              у межах однієї воронки. Уперед лише на{" "}
              <span className="font-medium">наступну</span> стадію (правила Flow
              Engine); назад можна швидше. Клік по картці — відкрити робоче місце.
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {boardGroups.length === 0 ? (
              <div className="min-h-[200px] w-full py-4">
                <KanbanEmptyColumn message="Немає колонок воронки. Перевірте пайплайн замовлень у налаштуваннях." />
              </div>
            ) : (
              boardGroups.map(
                ({
                  stageId,
                  stageName,
                  stageSortOrder,
                  pipelineId,
                  pipelineName,
                  rows: list,
                }) => (
                  <div
                    key={stageId}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDragOverStageId(stageId);
                    }}
                    onDragLeave={(e) => {
                      const next = e.relatedTarget as Node | null;
                      if (next && e.currentTarget.contains(next)) return;
                      setDragOverStageId((cur) =>
                        cur === stageId ? null : cur,
                      );
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverStageId(null);
                      const dealId = e.dataTransfer.getData(DEAL_DND_MIME);
                      if (!dealId) return;
                      void applyStageFromBoard(dealId, {
                        stageId,
                        stageName,
                        stageSortOrder,
                        pipelineId,
                      });
                    }}
                    className={cn(
                      "w-72 shrink-0 rounded-2xl border bg-[var(--enver-card)] p-2 transition-colors",
                      dragOverStageId === stageId
                        ? "border-[var(--enver-accent)] ring-2 ring-[var(--enver-accent-ring)]"
                        : "border-[var(--enver-border)]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 px-1 pb-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold leading-tight text-[var(--enver-text)]">
                          {stageName}
                        </p>
                        {showPipelineOnBoard && pipelineName ? (
                          <p className="mt-0.5 truncate text-[9px] font-medium text-[var(--enver-muted)]">
                            {pipelineName}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className="shrink-0 rounded-full border border-[var(--enver-border)] bg-[var(--enver-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--enver-text-muted)]"
                        aria-label={`Кількість замовлень: ${list.length}`}
                      >
                        {list.length}
                      </span>
                    </div>
                    <ul
                      className="min-h-[120px] max-h-[62vh] space-y-2 overflow-y-auto pr-1"
                      ref={(node) => {
                        if (!node) return;
                        restoreBoardScroll(stageId, node);
                      }}
                      onScroll={(event) => {
                        const el = event.currentTarget;
                        updateBoardScroll(stageId, el.scrollTop);
                        const nearBottom =
                          el.scrollTop + el.clientHeight >= el.scrollHeight - 180;
                        if (!nearBottom) return;
                        setVisibleBoardRows((prev) => {
                          const current = prev[stageId] ?? INITIAL_BOARD_ROWS;
                          if (current >= list.length) return prev;
                          return {
                            ...prev,
                            [stageId]: Math.min(
                              list.length,
                              current + BOARD_ROWS_STEP,
                            ),
                          };
                        });
                      }}
                    >
                      {list.length === 0 ? (
                        <li>
                          <KanbanEmptyColumn
                            className="min-h-[100px] border-dashed py-4"
                            message="Немає замовлень у стадії"
                          />
                        </li>
                      ) : null}
                      {list
                        .slice(0, visibleBoardRows[stageId] ?? INITIAL_BOARD_ROWS)
                        .map((r) => {
                        const canDrag = r.status === "OPEN";
                        const busy = movingDealId === r.id;
                        return (
                          <li key={r.id}>
                            <div
                              className={cn(
                                "flex overflow-hidden rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] text-[11px] shadow-sm transition",
                                busy && "opacity-60",
                              )}
                            >
                              <div
                                draggable={canDrag}
                                title={
                                  canDrag
                                    ? "Перетягнути в іншу колонку"
                                    : "Лише відкриті замовлення можна перетягувати"
                                }
                                onDragStart={(e) => {
                                  if (!canDrag) {
                                    e.preventDefault();
                                    return;
                                  }
                                  e.dataTransfer.setData(DEAL_DND_MIME, r.id);
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => setDragOverStageId(null)}
                                className={cn(
                                  "flex shrink-0 flex-col items-center justify-center border-r border-dashed border-[var(--enver-border)] px-1 py-2",
                                  canDrag
                                    ? "cursor-grab active:cursor-grabbing active:bg-[var(--enver-hover)]"
                                    : "cursor-not-allowed opacity-40",
                                )}
                                aria-label={
                                  canDrag
                                    ? "Перетягнути замовлення в іншу колонку"
                                    : undefined
                                }
                              >
                                <GripVertical
                                  className="h-4 w-4 text-[var(--enver-muted)]"
                                  aria-hidden
                                />
                              </div>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => openWorkspace(r.id)}
                                className="min-w-0 flex-1 px-2.5 py-2.5 text-left transition hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]"
                              >
                                {showPipelineColumn ? (
                                  <p className="mb-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-[var(--enver-muted)]">
                                    {r.pipelineName}
                                  </p>
                                ) : null}
                                <p className="font-semibold text-[var(--enver-text)]">
                                  {r.clientName}
                                </p>
                                <p className="truncate text-[var(--enver-muted)]">
                                  {r.title}
                                </p>
                                {r.value != null ? (
                                  <p className="mt-1 text-[10px] font-medium text-[var(--enver-text-muted)]">
                                    {r.value.toLocaleString("uk-UA")}{" "}
                                    {r.currency ?? ""}
                                  </p>
                                ) : null}
                                {r.warningBadge ? (
                                  <p className="mt-1 text-[10px] text-rose-700">
                                    {r.warningBadge === "critical"
                                      ? "Критичний ризик"
                                      : "Потрібна увага"}
                                  </p>
                                ) : null}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                      {list.length > (visibleBoardRows[stageId] ?? INITIAL_BOARD_ROWS) ? (
                        <li className="px-1 pb-1 text-center text-[10px] text-[var(--enver-muted)]">
                          Показано {visibleBoardRows[stageId] ?? INITIAL_BOARD_ROWS} з{" "}
                          {list.length}. Прокрутіть нижче для підвантаження.
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ),
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
