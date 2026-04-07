"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CheckSquare, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { postFormData, postJson } from "../../lib/api/patch-json";
import { parseResponseJson } from "../../lib/api/parse-response-json";
import type { PriceImportRowNorm } from "../../lib/materials/price-import-excel";
import type { AiEnrichedPriceRow } from "../../lib/materials/price-import-ai";

type ProviderRow = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  itemsCount: number;
  updatedAt: string;
};

type Props = {
  canManage: boolean;
};

export function LibraryMaterialsPricesClient({ canManage }: Props) {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loadBusy, setLoadBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [providerKey, setProviderKey] = useState("custom");
  const [providerName, setProviderName] = useState("Прайс");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [file, setFile] = useState<File | null>(null);

  const [rawRows, setRawRows] = useState<PriceImportRowNorm[] | null>(null);
  const [parsedName, setParsedName] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<AiEnrichedPriceRow[] | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const [parseBusy, setParseBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);

  const totalItems = useMemo(
    () => providers.reduce((a, p) => a + p.itemsCount, 0),
    [providers],
  );

  const loadProviders = useCallback(async () => {
    setLoadBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/library/materials/providers");
      const j = await parseResponseJson<{ providers?: ProviderRow[]; error?: string }>(r);
      if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити каталог");
      setProviders(j.providers ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoadBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const parseFile = async () => {
    if (!file) {
      setErr("Оберіть Excel (.xlsx / .xls)");
      return;
    }
    setParseBusy(true);
    setErr(null);
    setOk(null);
    setEnriched(null);
    setAiNote(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const j = await postFormData<{
        rows?: PriceImportRowNorm[];
        fileName?: string;
        error?: string;
      }>("/api/library/materials/parse", fd);
      setRawRows(j.rows ?? []);
      setParsedName(j.fileName ?? file.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setParseBusy(false);
    }
  };

  const runAi = async (skipAi: boolean) => {
    if (!rawRows?.length) {
      setErr("Спочатку завантажте та розпізнайте файл");
      return;
    }
    setAiBusy(true);
    setErr(null);
    setOk(null);
    try {
      const j = await postJson<{
        enriched?: AiEnrichedPriceRow[];
        usedAi?: boolean;
        aiError?: string | null;
        error?: string;
      }>("/api/library/materials/ai-normalize", { rows: rawRows, skipAi });
      setEnriched(j.enriched ?? []);
      setUsedAi(Boolean(j.usedAi));
      setAiNote(
        j.aiError
          ? `ШІ: ${j.aiError} (застосовано евристику для частини рядків)`
          : null,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setAiBusy(false);
    }
  };

  const toggleRow = (sourceIndex: number) => {
    setEnriched((prev) => {
      if (!prev) return prev;
      return prev.map((row) =>
        row.sourceIndex === sourceIndex
          ? { ...row, selected: !row.selected }
          : row,
      );
    });
  };

  const selectAll = (value: boolean) => {
    setEnriched((prev) => prev?.map((r) => ({ ...r, selected: value })) ?? null);
  };

  const commit = async () => {
    if (!enriched?.length || !rawRows?.length) {
      setErr("Немає даних для збереження");
      return;
    }
    const selected = enriched.filter((e) => e.selected);
    if (selected.length === 0) {
      setErr("Оберіть хоча б один рядок");
      return;
    }

    setCommitBusy(true);
    setErr(null);
    setOk(null);
    try {
      const items = selected.map((e) => {
        const base = rawRows[e.sourceIndex];
        if (!base) throw new Error(`Некоректний індекс ${e.sourceIndex}`);
        return {
          externalId: base.externalId,
          name: e.name,
          displayName: e.displayName,
          category: e.category,
          brand: e.brand,
          unit: e.unit,
          price: e.price,
          sourceUrl: base.sourceUrl,
          rawDataJson: {
            ...base.rawDataJson,
            libraryAi: {
              groupKey: e.groupKey,
              note: e.note,
              usedAi,
            },
          },
        };
      });

      const j = await postJson<{
        ok?: boolean;
        upserted?: number;
        deleted?: number;
        error?: string;
      }>("/api/library/materials/commit", {
          providerKey,
          providerName,
          mode,
          items,
      });
      setOk(
        `Збережено в каталог: ${j.upserted ?? 0} позицій` +
          (typeof j.deleted === "number" && j.deleted > 0
            ? ` (видалено попередніх ${j.deleted} у режимі replace)`
            : ""),
      );
      setFile(null);
      setRawRows(null);
      setEnriched(null);
      setParsedName(null);
      const input = document.getElementById("library-mat-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadProviders();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setCommitBusy(false);
    }
  };

  const groupedPreview = useMemo(() => {
    if (!enriched?.length) return [];
    const m = new Map<string, AiEnrichedPriceRow[]>();
    for (const r of enriched) {
      const k = r.groupKey || "—";
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [enriched]);

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)] px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4">
        <nav className="text-[11px] text-slate-500">
          <Link href="/library" className="text-[var(--enver-accent)] hover:underline">
            Бібліотека
          </Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="font-medium text-slate-800">Прайси матеріалів</span>
        </nav>

        <header className="rounded-lg border border-slate-200/90 bg-[var(--enver-card)] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  ENVER CRM · бібліотека
                </p>
                <h1 className="mt-1 text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
                  Прайси матеріалів
                </h1>
                <p className="mt-1 max-w-2xl text-xs text-slate-600 md:text-sm">
                  Імпорт Excel, автоматична перевірка та групування (ШІ або евристика), вибір позицій і
                  збереження у каталозі для смет і пошуку.
                </p>
              </div>
            </div>
          </div>
        </header>

        {!canManage ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Перегляд каталогу доступний. Для імпорту та збереження потрібне право{" "}
            <strong>Налаштування → керування</strong> (SETTINGS_MANAGE).
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">1. Завантаження прайса</h2>
          <p className="mt-1 text-xs text-slate-600">
            Колонки: найменування, ціна, одиниця, за бажанням — категорія, бренд, код, посилання.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="text-slate-500">Ключ провайдера</span>
              <input
                value={providerKey}
                onChange={(e) => setProviderKey(e.target.value)}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-60"
              />
            </label>
            <label className="text-xs">
              <span className="text-slate-500">Назва прайса</span>
              <input
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-60"
              />
            </label>
            <label className="text-xs">
              <span className="text-slate-500">Режим</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "append" | "replace")}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-60"
              >
                <option value="append">Додати / оновити за кодом</option>
                <option value="replace">Замінити всі позиції цього провайдера</option>
              </select>
            </label>
            <label className="text-xs">
              <span className="text-slate-500">Файл Excel</span>
              <input
                id="library-mat-file"
                type="file"
                accept=".xlsx,.xls"
                disabled={!canManage}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-60"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canManage || parseBusy || !file}
              onClick={() => void parseFile()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {parseBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Розпізнати файл
            </button>
            {parsedName ? (
              <span className="text-xs text-slate-600">
                {parsedName} · {rawRows?.length ?? 0} рядків
              </span>
            ) : null}
          </div>
        </div>

        {rawRows?.length ? (
          <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--enver-text)]">2. Групування та нормалізація</h2>
            <p className="mt-1 text-xs text-slate-600">
              ШІ пропонує категорії, бренди, групи (groupKey) і перевіряє ціни. Можна обійтися евристикою без
              API-ключа.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canManage || aiBusy}
                onClick={() => void runAi(false)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Запустити ШІ
              </button>
              <button
                type="button"
                disabled={!canManage || aiBusy}
                onClick={() => void runAi(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 disabled:opacity-50"
              >
                Лише евристика
              </button>
            </div>
            {aiNote ? <p className="mt-2 text-xs text-amber-800">{aiNote}</p> : null}
            {enriched?.length ? (
              <p className="mt-2 text-xs text-slate-600">
                {usedAi ? "Використано модель ШІ." : "Евристика без ШІ."} Груп: {groupedPreview.length}
              </p>
            ) : null}
          </div>
        ) : null}

        {enriched?.length ? (
          <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--enver-text)]">3. Вибір і збереження</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => selectAll(true)}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700"
                >
                  <CheckSquare className="h-3.5 w-3.5" /> Усі
                </button>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => selectAll(false)}
                  className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700"
                >
                  Жодної
                </button>
              </div>
            </div>

            <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-left text-slate-600">
                    <th className="border border-slate-200 px-1.5 py-1">✓</th>
                    <th className="border border-slate-200 px-1.5 py-1">Група</th>
                    <th className="border border-slate-200 px-1.5 py-1">Категорія</th>
                    <th className="border border-slate-200 px-1.5 py-1">Бренд</th>
                    <th className="border border-slate-200 px-1.5 py-1">Назва</th>
                    <th className="border border-slate-200 px-1.5 py-1">Од.</th>
                    <th className="border border-slate-200 px-1.5 py-1 text-right">Ціна</th>
                    <th className="border border-slate-200 px-1.5 py-1">Примітка</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((row) => (
                    <tr
                      key={row.sourceIndex}
                      className={row.selected ? "hover:bg-[var(--enver-hover)]" : "bg-slate-50/80 opacity-70"}
                    >
                      <td className="border border-slate-200 px-1.5 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={!canManage}
                          onChange={() => toggleRow(row.sourceIndex)}
                          className="accent-slate-900"
                        />
                      </td>
                      <td className="border border-slate-200 px-1.5 py-1 font-mono text-[10px] text-slate-700">
                        {row.groupKey}
                      </td>
                      <td className="border border-slate-200 px-1.5 py-1">{row.category ?? "—"}</td>
                      <td className="border border-slate-200 px-1.5 py-1">{row.brand ?? "—"}</td>
                      <td className="border border-slate-200 px-1.5 py-1 text-[var(--enver-text)]">
                        {row.displayName ?? row.name}
                      </td>
                      <td className="border border-slate-200 px-1.5 py-1">{row.unit}</td>
                      <td className="border border-slate-200 px-1.5 py-1 text-right tabular-nums">
                        {row.price != null ? row.price.toLocaleString("uk-UA") : "—"}
                      </td>
                      <td className="border border-slate-200 px-1.5 py-1 text-slate-500">{row.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <button
                type="button"
                disabled={!canManage || commitBusy}
                onClick={() => void commit()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {commitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Зберегти в каталог
              </button>
            </div>
          </div>
        ) : null}

        {ok ? <p className="text-xs text-emerald-700">{ok}</p> : null}
        {err ? <p className="text-xs text-rose-600">{err}</p> : null}

        <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--enver-text)]">Каталог у системі</h2>
            <button
              type="button"
              onClick={() => void loadProviders()}
              disabled={loadBusy}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
            >
              Оновити
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Провайдерів: {providers.length} · Позицій: {totalItems.toLocaleString("uk-UA")}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-left text-slate-600">
                  <th className="border border-slate-200 px-2 py-1.5">Провайдер</th>
                  <th className="border border-slate-200 px-2 py-1.5">Ключ</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-right">Позицій</th>
                  <th className="border border-slate-200 px-2 py-1.5">Оновлено</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--enver-hover)]">
                    <td className="border border-slate-200 px-2 py-1.5 text-[var(--enver-text)]">{p.name}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-slate-700">{p.key}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                      {p.itemsCount.toLocaleString("uk-UA")}
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 text-slate-600">
                      {new Date(p.updatedAt).toLocaleString("uk-UA")}
                    </td>
                  </tr>
                ))}
                {providers.length === 0 ? (
                  <tr>
                    <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={4}>
                      Каталог порожній.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Дубльований імпорт також налаштовано в{" "}
            <Link href="/settings/materials" className="text-[var(--enver-accent)] underline">
              Налаштування → База матеріалів
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
