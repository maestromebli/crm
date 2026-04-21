"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { patchDealProductionLaunchByDealId } from "@/features/deal-workspace/use-deal-mutation-actions";
import { postJson } from "@/lib/api/patch-json";

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
        const j = await postJson<{
          error?: string;
          handoffImportedFileCount?: number | null;
        }>(`/api/deals/${rowId}/production-launch`, {});
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
      const j = await postJson<{
        error?: string;
        affected?: number;
      }>("/api/production/queue-actions", { action });
      setBulkInfo(
        action === "launch_ready"
          ? `Масовий запуск: ${j.affected ?? 0}`
          : `Масовий повтор: ${j.affected ?? 0}`,
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
      "ID замовлення",
      "Назва",
      "Клієнт",
      "Власник",
      "Статус передачі",
      "Статус запуску",
      "SLA години",
      "Оновлено",
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
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 bg-slate-50/70 px-3 py-2.5">
        <span className="text-sm text-slate-600">Фільтр:</span>
        {[
          { id: "all", label: "Усі" },
          { id: "failed", label: "Помилки" },
          { id: "ready", label: "Готові" },
          { id: "sla", label: "Порушення SLA" },
          { id: "waiting", label: "Очікують прийняття" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id as typeof filter)}
            className={`rounded px-2.5 py-1.5 text-sm ${
              filter === f.id
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-[var(--enver-card)] text-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          Автооновлення: 25с
        </span>
        <button
          type="button"
          disabled={Boolean(bulkBusy)}
          onClick={() => void runBulk("launch_ready")}
          className="rounded border border-slate-900 bg-slate-900 px-2.5 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {bulkBusy === "launch_ready" ? "Запуск..." : "Запустити всі готові"}
        </button>
        <button
          type="button"
          disabled={Boolean(bulkBusy)}
          onClick={() => void runBulk("retry_failed")}
          className="rounded border border-slate-300 bg-[var(--enver-card)] px-2.5 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40"
        >
          {bulkBusy === "retry_failed" ? "Повтор..." : "Повторити всі з помилкою"}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded border border-slate-300 bg-[var(--enver-card)] px-2.5 py-1.5 text-sm font-medium text-slate-700"
        >
          Експорт CSV
        </button>
        {bulkInfo ? (
          <span className="text-xs text-slate-600">{bulkInfo}</span>
        ) : null}
        {lastLaunchInfo ? (
          <span className="max-w-[min(100vw-2rem,28rem)] truncate text-xs text-emerald-800">
            {lastLaunchInfo}
          </span>
        ) : null}
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Замовлення</th>
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
                <td className="px-4 py-3.5">
                  <a
                    href={`/production/${r.id}`}
                    className="font-medium text-[var(--enver-text)] hover:underline"
                  >
                    {r.title}
                  </a>
                  <a
                    href={`/deals/${r.id}/workspace?tab=production`}
                    className="ml-2 text-xs font-normal text-slate-500 hover:underline"
                  >
                    замовлення
                  </a>
                </td>
                <td className="px-4 py-3.5 text-slate-700">{r.clientName}</td>
                <td className="px-4 py-3.5 text-slate-700">{r.ownerName}</td>
                <td className="px-4 py-3.5">
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {r.handoffStatus ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3.5">
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
                <td className="px-4 py-3.5">
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
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={isBusy || !canLaunch}
                      onClick={() => void runAction(r.id, "launch")}
                      className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                    >
                      Запустити
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || r.launchStatus !== "FAILED"}
                      onClick={() => void runAction(r.id, "retry")}
                      className="rounded border border-slate-300 bg-[var(--enver-card)] px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
                    >
                      Повторити
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || launched}
                      onClick={() => void runAction(r.id, "fail")}
                      className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 disabled:opacity-40"
                    >
                      Позначити як помилку
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs text-slate-500">
                  {new Date(r.updatedAt).toLocaleString("uk-UA")}
                </td>
              </tr>
            );
          })}
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                Немає замовлень за поточним фільтром.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
