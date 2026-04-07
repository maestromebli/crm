"use client";

import Link from "next/link";
import { Download, RefreshCw, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FinanceExecutiveKpi } from "../lib/aggregation";
import {
  executiveKpiNotesMapFromRows,
  isFinanceExecutiveKpiMetricId,
  normalizeKpiPayload,
  type ExecutiveKpiNoteRow,
  type ExecutiveKpiNotesMap,
} from "../lib/executive-kpi-notes";
import { postJson } from "@/lib/api/patch-json";
import { SummaryCard } from "@/components/shared/SummaryCard";
import { Button } from "../../../components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "../../../components/ui/sheet";
import {
  FinanceKpiMetricFormPanel,
  FINANCE_KPI_SHEET_COPY,
  type FinanceKpiMetricId,
} from "./FinanceKpiMetricForms";
import { formatMoneyUa } from "../lib/format-money";

function payloadFromImportedValue(_metricId: string, val: unknown): Record<string, string> {
  if (val != null && typeof val === "object" && !Array.isArray(val) && "payload" in val) {
    return normalizeKpiPayload((val as ExecutiveKpiNoteRow).payload);
  }
  if (val != null && typeof val === "object" && !Array.isArray(val)) {
    return normalizeKpiPayload(val);
  }
  return {};
}

type Props = {
  kpi: FinanceExecutiveKpi;
  initialNotesMap: ExecutiveKpiNotesMap;
  canEditNotes: boolean;
};

/**
 * Верхній KPI-ряд: гроші, дебіторка/кредиторка, шари закупівель.
 * Картки відкривають форму з PostgreSQL + локальний резерв у sessionStorage.
 */
export function FinanceExecutiveKpiStrip({ kpi, initialNotesMap, canEditNotes }: Props) {
  const [notesMap, setNotesMap] = useState<ExecutiveKpiNotesMap>(initialNotesMap);
  useEffect(() => {
    setNotesMap(initialNotesMap);
  }, [initialNotesMap]);

  const [openMetric, setOpenMetric] = useState<FinanceKpiMetricId | null>(null);

  const open = (id: FinanceKpiMetricId) => () => setOpenMetric(id);

  const onPersistSuccess = useCallback((row: ExecutiveKpiNoteRow) => {
    setNotesMap((prev) => ({ ...prev, [row.metricId]: row }));
  }, []);

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadNotesFromApi = useCallback(async (opts?: { showSpinner?: boolean }) => {
    const spin = opts?.showSpinner !== false;
    if (spin) setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/finance/executive-kpi-notes", { cache: "no-store" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Не вдалося завантажити нотатки");
      }
      const data = (await res.json()) as { notes?: ExecutiveKpiNoteRow[] };
      setNotesMap(executiveKpiNotesMapFromRows(data.notes ?? []));
      setLastSyncedAt(new Date().toISOString());
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Помилка мережі");
    } finally {
      if (spin) setSyncing(false);
    }
  }, []);

  const syncFromServer = useCallback(() => loadNotesFromApi({ showSpinner: true }), [loadNotesFromApi]);

  const onImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !canEditNotes) return;
      setImporting(true);
      setImportError(null);
      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Очікується JSON-об'єкт (як файл експорту)");
        }
        const obj = parsed as Record<string, unknown>;
        const metricIds = Object.keys(obj).filter((k) => isFinanceExecutiveKpiMetricId(k));
        if (metricIds.length === 0) {
          throw new Error("Немає ключів метрик executive KPI");
        }
        const notes: Record<string, Record<string, string>> = {};
        for (const metricId of metricIds) {
          notes[metricId] = payloadFromImportedValue(metricId, obj[metricId]);
        }
        await postJson<{ ok?: boolean }>("/api/finance/executive-kpi-notes/import", {
          notes,
        });
        await loadNotesFromApi({ showSpinner: false });
      } catch (e) {
        setImportError(e instanceof Error ? e.message : "Помилка імпорту");
      } finally {
        setImporting(false);
      }
    },
    [canEditNotes, loadNotesFromApi],
  );

  const exportNotesJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(notesMap, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `executive-kpi-notes-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  }, [notesMap]);

  const noteRow = openMetric ? notesMap[openMetric] : undefined;

  return (
    <>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-500">
          Синя крапка на картці — у PostgreSQL є збережені уточнення до метрики.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(ev) => void onImportFile(ev)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={syncing || importing || !canEditNotes}
            onClick={() => fileInputRef.current?.click()}
            title={!canEditNotes ? "Потрібне право на редагування уточнень KPI" : undefined}
          >
            <Upload className={`h-3.5 w-3.5 ${importing ? "animate-pulse" : ""}`} aria-hidden />
            {importing ? "Імпорт…" : "Імпорт JSON"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={syncing || importing}
            onClick={() => void syncFromServer()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden />
            {syncing ? "Оновлення…" : "Синхронізувати"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={importing}
            onClick={exportNotesJson}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Експорт JSON
          </Button>
          {lastSyncedAt ? (
            <span className="text-[10px] text-slate-400" title={lastSyncedAt}>
              Остання синхронізація:{" "}
              {new Date(lastSyncedAt).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "medium" })}
            </span>
          ) : null}
        </div>
      </div>
      {syncError ? <p className="mb-2 text-[11px] text-red-700">{syncError}</p> : null}
      {importError ? <p className="mb-2 text-[11px] text-red-700">{importError}</p> : null}

      <div className="space-y-2" role="region" aria-label="Показники executive KPI">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <SummaryCard
            label="Портфель договорів"
            value={formatMoneyUa(kpi.contractPortfolio, 2)}
            tone="neutral"
            onClick={open("contractPortfolio")}
            hasSavedNote={!!notesMap.contractPortfolio}
          />
          <SummaryCard
            label="Отримано від клієнтів"
            value={formatMoneyUa(kpi.receivedFromClients, 2)}
            tone="income"
            onClick={open("receivedFromClients")}
            hasSavedNote={!!notesMap.receivedFromClients}
          />
          <SummaryCard
            label="Дебіторка"
            value={formatMoneyUa(kpi.receivables, 2)}
            tone="warning"
            hint="Договір − факт оплат"
            onClick={open("receivables")}
            hasSavedNote={!!notesMap.receivables}
          />
          <SummaryCard
            label="Кредиторка (PO)"
            value={formatMoneyUa(kpi.payables, 2)}
            tone="expense"
            hint="Відкриті зобовʼязання"
            onClick={open("payables")}
            hasSavedNote={!!notesMap.payables}
          />
          <SummaryCard
            label="Грошові витрати (cash)"
            value={formatMoneyUa(kpi.cashOperatingExpenses, 2)}
            tone="expense"
            onClick={open("cashOperatingExpenses")}
            hasSavedNote={!!notesMap.cashOperatingExpenses}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <SummaryCard
            label="План закупівель (позиції)"
            value={formatMoneyUa(kpi.procurementPlanned, 2)}
            tone="neutral"
            hint="Шар планування"
            onClick={open("procurementPlanned")}
            hasSavedNote={!!notesMap.procurementPlanned}
          />
          <SummaryCard
            label="Факт позицій (accrual)"
            value={formatMoneyUa(kpi.procurementAccrual, 2)}
            tone="neutral"
            hint="Не підсумовуємо в cash"
            onClick={open("procurementAccrual")}
            hasSavedNote={!!notesMap.procurementAccrual}
          />
          <SummaryCard
            label="Зобовʼязання PO"
            value={formatMoneyUa(kpi.procurementCommitted, 2)}
            tone="neutral"
            hint="Шар комітменту"
            onClick={open("procurementCommitted")}
            hasSavedNote={!!notesMap.procurementCommitted}
          />
          <SummaryCard
            label="Отримано по PO"
            value={formatMoneyUa(kpi.procurementReceivedValue, 2)}
            tone="income"
            hint="receivedQty × ціна"
            onClick={open("procurementReceivedValue")}
            hasSavedNote={!!notesMap.procurementReceivedValue}
          />
          <SummaryCard
            label="Чистий прибуток (cash)"
            value={formatMoneyUa(kpi.netProfitCash, 2)}
            tone={kpi.netProfitCash >= 0 ? "income" : "expense"}
            onClick={open("netProfitCash")}
            hasSavedNote={!!notesMap.netProfitCash}
          />
        </div>
      </div>

      <Sheet open={openMetric !== null} onOpenChange={(o) => !o && setOpenMetric(null)}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto border-l border-slate-200">
          {openMetric ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-base font-semibold text-[var(--enver-text)]">
                    {FINANCE_KPI_SHEET_COPY[openMetric].title}
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs text-slate-600">
                    {FINANCE_KPI_SHEET_COPY[openMetric].subtitle}
                  </SheetDescription>
                </div>
                <SheetClose asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[var(--enver-text)]"
                    aria-label="Закрити панель"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </SheetClose>
              </div>
              <div className="mt-4">
                <FinanceKpiMetricFormPanel
                  kpi={kpi}
                  metric={openMetric}
                  noteRow={noteRow}
                  canEdit={canEditNotes}
                  onPersistSuccess={onPersistSuccess}
                />
              </div>
              <div className="mt-6 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                <span className="font-medium text-slate-700">Звʼязані розділи:</span>{" "}
                <Link href="/crm/finance/registry" className="text-blue-700 underline hover:text-blue-900">
                  Реєстр проєктів
                </Link>
                {" · "}
                <Link href="/crm/procurement" className="text-blue-700 underline hover:text-blue-900">
                  Закупівлі
                </Link>
                {" · "}
                <Link href="/crm/finance/banking" className="text-blue-700 underline hover:text-blue-900">
                  Банкінг
                </Link>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
