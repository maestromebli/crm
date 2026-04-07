"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { postFormData } from "../../lib/api/patch-json";
import { parseResponseJson } from "../../lib/api/parse-response-json";

type ProviderRow = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  itemsCount: number;
  updatedAt: string;
};

export function SettingsMaterialsCatalogManager() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loadBusy, setLoadBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [providerKey, setProviderKey] = useState("viyar");
  const [providerName, setProviderName] = useState("VIYAR");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [file, setFile] = useState<File | null>(null);

  const totalItems = useMemo(
    () => providers.reduce((a, p) => a + p.itemsCount, 0),
    [providers],
  );

  const loadProviders = async () => {
    setLoadBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/settings/materials/import");
      const j = await parseResponseJson<{ providers?: ProviderRow[]; error?: string }>(r);
      if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити провайдери");
      setProviders(j.providers ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoadBusy(false);
    }
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const importExcel = async () => {
    if (!file) {
      setErr("Оберіть Excel-файл (.xlsx / .xls)");
      return;
    }
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("providerKey", providerKey);
      fd.append("providerName", providerName);
      fd.append("mode", mode);

      const j = await postFormData<{
        ok?: boolean;
        upserted?: number;
        skipped?: number;
        deleted?: number;
        error?: string;
      }>("/api/settings/materials/import", fd);
      setOk(
        `Імпорт виконано: ${j.upserted ?? 0} рядків оновлено` +
          (typeof j.skipped === "number" ? `, пропущено ${j.skipped}` : "") +
          (typeof j.deleted === "number" && j.deleted > 0
            ? `, видалено попередніх ${j.deleted}`
            : ""),
      );
      setFile(null);
      const input = document.getElementById("materials-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadProviders();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка імпорту");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[var(--enver-text)]">Імпорт прайса матеріалів</h3>
        <p className="mt-1 text-xs text-slate-600">
          Завантажте Excel з прайсом — система виконає AI/heuristic-обробку:
          нормалізація назв, категорій, брендів та цін, після чого оновить базу матеріалів.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="text-slate-500">Ключ провайдера</span>
            <input
              value={providerKey}
              onChange={(e) => setProviderKey(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="viyar"
            />
          </label>
          <label className="text-xs">
            <span className="text-slate-500">Назва провайдера</span>
            <input
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="VIYAR"
            />
          </label>
          <label className="text-xs">
            <span className="text-slate-500">Режим імпорту</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "append" | "replace")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="append">Append (додати / оновити)</option>
              <option value="replace">Replace (замінити всі позиції провайдера)</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="text-slate-500">Excel-файл прайса</span>
            <input
              id="materials-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void importExcel()}
            disabled={busy || !file}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Імпортувати прайс
          </button>
          {file ? <span className="text-xs text-slate-600">{file.name}</span> : null}
        </div>

        {ok ? <p className="mt-2 text-xs text-emerald-700">{ok}</p> : null}
        {err ? <p className="mt-2 text-xs text-rose-600">{err}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--enver-text)]">База матеріалів</h3>
          <button
            type="button"
            onClick={() => void loadProviders()}
            disabled={loadBusy}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
          >
            Оновити
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Провайдерів: {providers.length} · Позицій: {totalItems}</p>

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
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{p.itemsCount.toLocaleString("uk-UA")}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-slate-600">
                    {new Date(p.updatedAt).toLocaleString("uk-UA")}
                  </td>
                </tr>
              ))}
              {providers.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={4}>
                    База матеріалів порожня. Завантажте перший прайс.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
