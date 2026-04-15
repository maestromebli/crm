"use client";

import { Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  SupplierPriceChangeEntry,
  SupplierSyncSummary,
} from "../core/supplierTypes";

type SyncStatus = {
  providers: Array<{
    key: string;
    name: string;
    itemsCount: number;
    lastUpdate: string | null;
  }>;
  recentPriceChanges: SupplierPriceChangeEntry[];
};

export function SupplierSyncPanel({
  canManage = true,
  defaultProviderKey = "viyar",
}: {
  canManage?: boolean;
  defaultProviderKey?: string;
}) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [providerKey, setProviderKey] = useState(defaultProviderKey);
  const [providerName, setProviderName] = useState("Viyar");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [lastSummary, setLastSummary] = useState<SupplierSyncSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/suppliers/sync");
      if (r.status === 401 || r.status === 403) {
        setStatus({ providers: [], recentPriceChanges: [] });
        return;
      }
      if (!r.ok) throw new Error("Не вдалося завантажити статус");
      setStatus((await r.json()) as SyncStatus);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sync = async () => {
    if (!file) return;
    setSyncBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("providerKey", providerKey);
      fd.append("providerName", providerName);
      fd.append("mode", mode);
      const r = await fetch("/api/suppliers/sync", { method: "POST", body: fd });
      const j = (await r.json()) as { summary?: SupplierSyncSummary; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка синхронізації");
      setLastSummary(j.summary ?? null);
      setFile(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Синхронізація постачальників</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs"
          disabled={busy}
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
          Оновити
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={providerKey}
          onChange={(e) => setProviderKey(e.target.value)}
          placeholder="ключ постачальника"
          disabled={!canManage}
          className="rounded border border-slate-200 px-2 py-1 text-xs"
        />
        <input
          value={providerName}
          onChange={(e) => setProviderName(e.target.value)}
          placeholder="назва постачальника"
          disabled={!canManage}
          className="rounded border border-slate-200 px-2 py-1 text-xs"
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "append" | "replace")}
          disabled={!canManage}
          className="rounded border border-slate-200 px-2 py-1 text-xs"
        >
          <option value="append">додати</option>
          <option value="replace">замінити</option>
        </select>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={!canManage}
          className="rounded border border-slate-200 px-2 py-1 text-xs"
        />
      </div>

      <button
        type="button"
        onClick={() => void sync()}
        disabled={!canManage || !file || syncBusy}
        className="mt-2 inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {syncBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
        Завантажити і синхронізувати
      </button>

      {lastSummary ? (
        <p className="mt-2 text-[11px] text-emerald-700">
          Синхронізація: {lastSummary.upserted} оновлено/додано, {lastSummary.changedPrices} змін цін,{" "}
          {lastSummary.markedOutdated} позначено як застарілі.
        </p>
      ) : null}
      {err ? <p className="mt-2 text-[11px] text-rose-600">{err}</p> : null}

      <div className="mt-3 space-y-1">
        {(status?.providers ?? []).map((p) => (
          <div key={p.key} className="rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[11px]">
            <span className="font-medium text-slate-800">{p.name}</span> ({p.key}) · {p.itemsCount} позицій ·{" "}
            {p.lastUpdate ? new Date(p.lastUpdate).toLocaleString("uk-UA") : "немає оновлень"}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h4 className="mb-1 text-xs font-semibold text-slate-800">
          Останні зміни цін
        </h4>
        <div className="max-h-80 overflow-auto rounded border border-slate-200">
          <table className="w-full min-w-[680px] border-collapse text-[11px]">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="border border-slate-200 px-2 py-1 text-left">Час</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Постачальник</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Код</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Позиція</th>
                <th className="border border-slate-200 px-2 py-1 text-right">Було</th>
                <th className="border border-slate-200 px-2 py-1 text-right">Стало</th>
                <th className="border border-slate-200 px-2 py-1 text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {(status?.recentPriceChanges ?? []).map((x) => {
                const delta = x.currentPrice - x.previousPrice;
                const up = delta > 0;
                return (
                  <tr key={x.id} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-2 py-1">
                      {new Date(x.changedAt).toLocaleString("uk-UA")}
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      {x.providerName}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 font-mono text-[10px]">
                      {x.itemExternalId}
                    </td>
                    <td className="border border-slate-200 px-2 py-1">{x.itemName}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right tabular-nums">
                      {x.previousPrice.toLocaleString("uk-UA")}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-right tabular-nums">
                      {x.currentPrice.toLocaleString("uk-UA")}
                    </td>
                    <td
                      className={`border border-slate-200 px-2 py-1 text-right tabular-nums font-medium ${
                        up ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {up ? "+" : ""}
                      {delta.toLocaleString("uk-UA", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
              {(status?.recentPriceChanges ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="border border-slate-200 px-2 py-3 text-center text-slate-500"
                  >
                    Поки немає зафіксованих змін цін.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
