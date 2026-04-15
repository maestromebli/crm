"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  isConstructorSlaOverdue,
  matchesConstructorBoardFilter,
  type ConstructorBoardFilterId,
} from "../../lib/production/constructors-board-filter";
import { CopyConstructorLinkButton } from "./CopyConstructorLinkButton";

export type ConstructorBoardRow = {
  id: string;
  title: string;
  clientName: string;
  updatedAt: string;
  room: null | {
    status: string;
    publicToken: string | null;
    priority: string;
    dueAt: string | null;
    deliveredAt: string | null;
    externalConstructorLabel: string | null;
    assignedUser: { name: string | null; email: string } | null;
  };
};

const STATUS_UA: Record<string, string> = {
  PENDING_ASSIGNMENT: "Не відкрита",
  SENT_TO_CONSTRUCTOR: "Надіслано",
  IN_PROGRESS: "У роботі",
  DELIVERED: "Здано",
  REVIEWED: "Перевірено",
};

const PRIORITY_UA: Record<string, string> = {
  LOW: "Низький",
  NORMAL: "Звичайний",
  HIGH: "Високий",
  URGENT: "Терміново",
};

function isOverdue(row: ConstructorBoardRow): boolean {
  const r = row.room;
  return isConstructorSlaOverdue(
    r
      ? { status: r.status, dueAt: r.dueAt }
      : null,
  );
}

type SortMode = "updated" | "dueAsc" | "priority";

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function compareByUpdatedDesc(
  a: ConstructorBoardRow,
  b: ConstructorBoardRow,
): number {
  const t =
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (t !== 0) return t;
  return a.id.localeCompare(b.id);
}

function sortConstructorRows(
  rows: ConstructorBoardRow[],
  mode: SortMode,
): ConstructorBoardRow[] {
  const arr = [...rows];
  switch (mode) {
    case "dueAsc":
      return arr.sort((a, b) => {
        const da = a.room?.dueAt
          ? new Date(a.room.dueAt).getTime()
          : Number.POSITIVE_INFINITY;
        const db = b.room?.dueAt
          ? new Date(b.room.dueAt).getTime()
          : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return compareByUpdatedDesc(a, b);
      });
    case "priority":
      return arr.sort((a, b) => {
        const pa = a.room
          ? PRIORITY_RANK[a.room.priority] ?? 99
          : 99;
        const pb = b.room
          ? PRIORITY_RANK[b.room.priority] ?? 99
          : 99;
        if (pa !== pb) return pa - pb;
        return compareByUpdatedDesc(a, b);
      });
    default:
      return arr.sort((a, b) => compareByUpdatedDesc(a, b));
  }
}

export function ConstructorsBoardClient({
  initialRows,
}: {
  initialRows: ConstructorBoardRow[];
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ConstructorBoardFilterId>("all");
  const [exportBusy, setExportBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [pageSize, setPageSize] = useState(25);
  const deferredQ = useDeferredValue(q);

  const stats = useMemo(() => {
    let noRoom = 0;
    let active = 0;
    let done = 0;
    let overdue = 0;
    for (const row of initialRows) {
      if (!row.room) noRoom++;
      else {
        const s = row.room.status;
        if (s === "REVIEWED" || s === "DELIVERED") done++;
        else active++;
        if (isOverdue(row)) overdue++;
      }
    }
    return {
      total: initialRows.length,
      noRoom,
      active,
      done,
      overdue,
    };
  }, [initialRows]);

  const filtered = useMemo(() => {
    return initialRows.filter((row) =>
      matchesConstructorBoardFilter(
        {
          title: row.title,
          clientName: row.clientName,
          room: row.room
            ? {
                status: row.room.status,
                dueAt: row.room.dueAt,
              }
            : null,
        },
        deferredQ,
        filter,
      ),
    );
  }, [initialRows, deferredQ, filter]);

  const sortedRows = useMemo(
    () => sortConstructorRows(filtered, sortMode),
    [filtered, sortMode],
  );

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filter, sortMode, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const exportCsv = () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const header = [
      "DealId",
      "Title",
      "Client",
      "Priority",
      "DueAt",
      "Status",
      "Internal",
      "External",
      "PublicPath",
      "PublicUrl",
      "Overdue",
      "UpdatedAt",
    ];
    const lines = sortedRows.map((row) => {
      const r = row.room;
      const overdue = isOverdue(row) ? "yes" : "";
      const publicPath = r?.publicToken ? `/c/${r.publicToken}` : "";
      const publicUrl =
        publicPath && origin ? `${origin}${publicPath}` : "";
      return [
        row.id,
        row.title,
        row.clientName,
        r?.priority ?? "",
        r?.dueAt ?? "",
        r ? STATUS_UA[r.status] ?? r.status : "",
        r?.assignedUser
          ? r.assignedUser.name?.trim() || r.assignedUser.email
          : "",
        r?.externalConstructorLabel ?? "",
        publicPath,
        publicUrl,
        overdue,
        row.updatedAt,
      ];
    });
    const csv = [header, ...lines]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `constructors-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportServerCsv = async () => {
    setExportBusy(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("filter", filter);
      const r = await fetch(
        `/api/production/constructors-board/export?${params.toString()}`,
        { credentials: "include" },
      );
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Помилка ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `constructors-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Не вдалося завантажити експорт",
      );
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(
          [
            ["total", "Усього у черзі", stats.total],
            ["active", "Активні", stats.active],
            ["overdue", "Прострочений SLA", stats.overdue],
            ["no_room", "Без кімнати", stats.noRoom],
            ["done", "Завершені", stats.done],
          ] as const
        ).map(([key, label, n]) => {
          const filterForKey: ConstructorBoardFilterId =
            key === "total"
              ? "all"
              : key === "no_room"
                ? "no_room"
                : key === "active"
                  ? "active"
                  : key === "overdue"
                    ? "overdue"
                    : "done";
          const activeCard = filter === filterForKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(filterForKey)}
              className={`rounded-xl border p-3 text-left shadow-sm transition hover:ring-2 hover:ring-slate-300/80 ${
                key === "overdue" && n > 0
                  ? "border-rose-200 bg-rose-50"
                  : "border-slate-200 bg-[var(--enver-card)]"
              } ${activeCard ? "ring-2 ring-slate-900" : ""}`}
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--enver-text)]">{n}</p>
            </button>
          );
        })}
      </section>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1 text-xs">
          <span className="text-slate-500">Пошук (угода / клієнт)</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Назва, клієнт…"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["all", "Усі"],
              ["active", "Активні"],
              ["overdue", "SLA"],
              ["no_room", "Без кімнати"],
              ["done", "Завершені"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                filter === id
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-[var(--enver-card)] text-slate-700 hover:bg-[var(--enver-hover)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="text-xs text-slate-500">
          Сортування
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="mt-1 block w-[min(100%,220px)] rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-sm text-[var(--enver-text)]"
          >
            <option value="updated">За оновленням угоди</option>
            <option value="dueAsc">Дедлайн (найближчі першими)</option>
            <option value="priority">Пріоритет (термінові першими)</option>
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Рядків на сторінці
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="mt-1 block rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-sm text-[var(--enver-text)]"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-slate-300 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          CSV (екран)
        </button>
        <button
          type="button"
          disabled={exportBusy}
          onClick={() => void exportServerCsv()}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          title="До 2000 угод з БД, UTF-8 для Excel"
        >
          {exportBusy ? "Завантаження…" : "CSV (сервер)"}
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Угода</th>
                <th className="px-4 py-3">Клієнт</th>
                <th className="px-4 py-3">Пріоритет</th>
                <th className="px-4 py-3">Дедлайн</th>
                <th className="px-4 py-3">Внутрішній</th>
                <th className="px-4 py-3">Зовнішній</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Посилання</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => {
                const cr = row.room;
                const statusUa = cr
                  ? STATUS_UA[cr.status] ?? cr.status
                  : "—";
                const internalName = cr?.assignedUser
                  ? cr.assignedUser.name?.trim() || cr.assignedUser.email
                  : "—";
                const extFull = cr?.externalConstructorLabel?.trim();
                const externalShort = extFull
                  ? extFull.length > 40
                    ? `${extFull.slice(0, 40)}…`
                    : extFull
                  : "—";
                const overdue = isOverdue(row);
                const dueStr = cr?.dueAt
                  ? new Date(cr.dueAt).toLocaleString("uk-UA", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";
                return (
                  <tr
                    key={row.id}
                    className={overdue ? "bg-rose-50/60" : undefined}
                  >
                    <td className="px-4 py-3">
                      <a
                        href={`/deals/${row.id}/workspace?tab=production`}
                        className="font-medium text-[var(--enver-text)] hover:underline"
                      >
                        {row.title}
                      </a>
                      {overdue ? (
                        <span className="ml-2 rounded bg-rose-200 px-1.5 py-0.5 text-[10px] font-semibold text-rose-900">
                          SLA
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.clientName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {cr ? PRIORITY_UA[cr.priority] ?? cr.priority : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                      {dueStr}
                    </td>
                    <td className="max-w-[120px] px-4 py-3 text-xs text-slate-700">
                      {internalName}
                    </td>
                    <td
                      className="max-w-[140px] px-4 py-3 text-xs text-slate-600"
                      title={extFull && extFull.length > 40 ? extFull : undefined}
                    >
                      {externalShort}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{statusUa}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/crm/production/constructor/${row.id}`}
                          className="text-indigo-700 underline"
                        >
                          Hub
                        </a>
                        {cr?.publicToken ? (
                          <CopyConstructorLinkButton publicToken={cr.publicToken} />
                        ) : (
                          <span className="text-slate-400">Створіть у вкладці угоди</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Нічого не знайдено за фільтром.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {sortedRows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <p>
              Показано{" "}
              <span className="font-medium text-[var(--enver-text)]">
                {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, sortedRows.length)}
              </span>{" "}
              з {sortedRows.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1 font-medium text-slate-800 disabled:opacity-40"
              >
                Назад
              </button>
              <span className="tabular-nums text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1 font-medium text-slate-800 disabled:opacity-40"
              >
                Далі
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
