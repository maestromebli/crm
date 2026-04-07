"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { patchDealProductionLaunchByDealId } from "@/features/deal-workspace/use-deal-mutation-actions";

export type ProductionQueueTableRow = {
  id: string;
  title: string;
  clientName: string;
  ownerName: string;
  handoffStatus: "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED" | null;
  launchStatus: "NOT_READY" | "QUEUED" | "LAUNCHING" | "LAUNCHED" | "FAILED";
  launchError: string | null;
  slaHours: number | null;
  slaWarn: boolean;
  updatedAt: string;
  priority: number;
};

export function ProductionQueueTableClient({
  rows,
}: {
  rows: ProductionQueueTableRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"" | "launch_ready" | "retry_failed">("");
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [bulkInfo, setBulkInfo] = useState<string>("");
  const [lastLaunchInfo, setLastLaunchInfo] = useState<string>("");
  const [filter, setFilter] = useState<
    "all" | "failed" | "ready" | "sla" | "waiting"
  >("all");

  useEffect(() => {
    const t = setInterval(() => {
      router.refresh();
    }, 25000);
    return () => clearInterval(t);
  }, [router]);

  const visibleRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "failed") return rows.filter((r) => r.launchStatus === "FAILED");
    if (filter === "ready") {
      return rows.filter(
        (r) => r.handoffStatus === "ACCEPTED" && r.launchStatus !== "LAUNCHED",
      );
    }
    if (filter === "sla") return rows.filter((r) => r.slaWarn);
    return rows.filter((r) => r.handoffStatus === "SUBMITTED");
  }, [rows, filter]);

  const runAction = async (
    rowId: string,
    action: "launch" | "retry" | "fail",
  ) => {
    setBusyId(rowId);
    setErrorById((prev) => ({ ...prev, [rowId]: "" }));
    try {
      if (action === "launch") {
        const r = await fetch(`/api/deals/${rowId}/production-launch`, {
          method: "POST",
        });
        const j = (await r.json().catch(() => ({}))) as {
          error?: string;
          handoffImportedFileCount?: number | null;
        };
        if (!r.ok) throw new Error(j.error ?? "Не вдалося виконати запуск");
        const n = j.handoffImportedFileCount;
        setLastLaunchInfo(
          typeof n === "number" && n > 0
            ? `Запуск: перенесено з передачі файлів: ${n}.`
            : "Запуск виконано.",
        );
        window.setTimeout(() => setLastLaunchInfo(""), 10000);
      } else {
        const j = await patchDealProductionLaunchByDealId(
          rowId,
          action === "retry"
            ? { action: "retry" }
            : { action: "fail", error: "Позначено вручну оператором черги" },
        );
        if (action === "retry") {
          const n = j.handoffImportedFileCount;
          setLastLaunchInfo(
            typeof n === "number" && n > 0
              ? `Повтор: перенесено з передачі файлів: ${n}.`
              : "Повтор запуску виконано.",
          );
          window.setTimeout(() => setLastLaunchInfo(""), 10000);
        }
      }
      router.refresh();
    } catch (e) {
      setErrorById((prev) => ({
        ...prev,
        [rowId]: e instanceof Error ? e.message : "Помилка дії",
      }));
    } finally {
      setBusyId(null);
    }
  };

  const runBulk = async (action: "launch_ready" | "retry_failed") => {
    setBulkBusy(action);
    setBulkInfo("");
    try {
      const r = await fetch("/api/production/queue-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        affected?: number;
      };
      if (!r.ok) throw new Error(j.error ?? "Помилка bulk-операції");
      setBulkInfo(
        action === "launch_ready"
          ? `Bulk launch: ${j.affected ?? 0}`
          : `Bulk retry: ${j.affected ?? 0}`,
      );
      router.refresh();
    } catch (e) {
      setBulkInfo(e instanceof Error ? e.message : "Помилка bulk-операції");
    } finally {
      setBulkBusy("");
    }
  };

  const exportCsv = () => {
    const header = [
      "DealId",
      "Title",
      "Client",
      "Owner",
      "HandoffStatus",
      "LaunchStatus",
      "SlaHours",
      "UpdatedAt",
    ];
    const rowsCsv = visibleRows.map((r) => [
      r.id,
      r.title,
      r.clientName,
      r.ownerName,
      r.handoffStatus ?? "",
      r.launchStatus,
      r.slaHours != null ? String(r.slaHours) : "",
      r.updatedAt,
    ]);
    const csv = [header, ...rowsCsv]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-queue-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-3 py-2">
        <span className="text-xs text-slate-500">Фільтр:</span>
        {[
          { id: "all", label: "Усі" },
          { id: "failed", label: "Помилки" },
          { id: "ready", label: "Готові" },
          { id: "sla", label: "SLA breach" },
          { id: "waiting", label: "Очікують прийняття" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id as typeof filter)}
            className={`rounded px-2 py-1 text-xs ${
              filter === f.id
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-[var(--enver-card)] text-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">
          Автооновлення: 25с
        </span>
        <button
          type="button"
          disabled={Boolean(bulkBusy)}
          onClick={() => void runBulk("launch_ready")}
          className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          {bulkBusy === "launch_ready" ? "Launch..." : "Launch all ready"}
        </button>
        <button
          type="button"
          disabled={Boolean(bulkBusy)}
          onClick={() => void runBulk("retry_failed")}
          className="rounded border border-slate-300 bg-[var(--enver-card)] px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
        >
          {bulkBusy === "retry_failed" ? "Retry..." : "Retry all failed"}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded border border-slate-300 bg-[var(--enver-card)] px-2 py-1 text-xs font-medium text-slate-700"
        >
          Export CSV
        </button>
        {bulkInfo ? (
          <span className="text-[11px] text-slate-600">{bulkInfo}</span>
        ) : null}
        {lastLaunchInfo ? (
          <span className="max-w-[min(100vw-2rem,28rem)] truncate text-[11px] text-emerald-800">
            {lastLaunchInfo}
          </span>
        ) : null}
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Угода</th>
            <th className="px-4 py-3">Клієнт</th>
            <th className="px-4 py-3">Власник</th>
            <th className="px-4 py-3">Передача</th>
            <th className="px-4 py-3">Запуск</th>
            <th className="px-4 py-3">SLA</th>
            <th className="px-4 py-3">Дії</th>
            <th className="px-4 py-3">Оновлено</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visibleRows.map((r) => {
            const launched = r.launchStatus === "LAUNCHED";
            const canLaunch = r.handoffStatus === "ACCEPTED" && !launched;
            const isBusy = busyId === r.id;
            return (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3">
                  <a
                    href={`/production/${r.id}`}
                    className="font-medium text-[var(--enver-text)] hover:underline"
                  >
                    {r.title}
                  </a>
                  <a
                    href={`/deals/${r.id}/workspace?tab=production`}
                    className="ml-2 text-[11px] font-normal text-slate-500 hover:underline"
                  >
                    угода
                  </a>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.clientName}</td>
                <td className="px-4 py-3 text-slate-700">{r.ownerName}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {r.handoffStatus ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      launched
                        ? "bg-emerald-100 text-emerald-800"
                        : r.launchStatus === "FAILED"
                          ? "bg-rose-100 text-rose-800"
                          : r.handoffStatus === "ACCEPTED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {r.launchStatus === "FAILED"
                      ? "Помилка запуску"
                      : launched
                        ? "Запущено"
                        : r.handoffStatus === "ACCEPTED"
                          ? "Готово до запуску"
                          : "Очікує прийняття"}
                  </span>
                  {r.launchError ? (
                    <p className="mt-1 text-xs text-rose-700">{r.launchError}</p>
                  ) : null}
                  {errorById[r.id] ? (
                    <p className="mt-1 text-xs text-rose-700">{errorById[r.id]}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {r.handoffStatus === "SUBMITTED" && r.slaHours !== null ? (
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        r.slaWarn
                          ? "bg-fuchsia-100 text-fuchsia-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {r.slaHours}h
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={isBusy || !canLaunch}
                      onClick={() => void runAction(r.id, "launch")}
                      className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                    >
                      Launch
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || r.launchStatus !== "FAILED"}
                      onClick={() => void runAction(r.id, "retry")}
                      className="rounded border border-slate-300 bg-[var(--enver-card)] px-2 py-1 text-[11px] font-medium text-slate-700 disabled:opacity-40"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || launched}
                      onClick={() => void runAction(r.id, "fail")}
                      className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 disabled:opacity-40"
                    >
                      Mark fail
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(r.updatedAt).toLocaleString("uk-UA")}
                </td>
              </tr>
            );
          })}
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                Немає угод за поточним фільтром.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
