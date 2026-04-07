"use client";

import { useMemo, useState } from "react";
import { DataTableShell } from "../../../components/shared/DataTableShell";
import type { DemoCampaign, TargetCampaignStatus } from "../types";
import { formatUah } from "../format";
import { buildCampaignsCsv } from "../lib/csv";
import { TargetStatusPill } from "./TargetStatusPill";

const STATUS_FILTER: Array<{ value: "" | TargetCampaignStatus; label: string }> = [
  { value: "", label: "Усі статуси" },
  { value: "ACTIVE", label: "Активні" },
  { value: "PAUSED", label: "На паузі" },
  { value: "ARCHIVED", label: "Архів" },
];

export function TargetCampaignsTable({ campaigns }: { campaigns: DemoCampaign[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | TargetCampaignStatus>("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (status && c.status !== status) return false;
      if (!qq) return true;
      return (
        c.name.toLowerCase().includes(qq) ||
        c.objective.toLowerCase().includes(qq) ||
        c.channel.toLowerCase().includes(qq)
      );
    });
  }, [campaigns, q, status]);

  const exportCsv = () => {
    const csv = buildCampaignsCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `target-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1 space-y-1">
          <label className="text-[10px] font-medium text-slate-500">Пошук</label>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Назва, ціль, канал…"
            className="w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] outline-none focus:border-slate-900"
          />
        </div>
        <div className="w-full min-w-[140px] max-w-[200px] space-y-1 sm:w-auto">
          <label className="text-[10px] font-medium text-slate-500">Статус</label>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "" | TargetCampaignStatus)
            }
            className="w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-[11px] outline-none focus:border-slate-900"
          >
            {STATUS_FILTER.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-medium text-orange-950 hover:bg-orange-100"
        >
          CSV (фільтр)
        </button>
        <a
          href="/api/target/campaigns/export"
          className="rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-[var(--enver-hover)]"
        >
          CSV (усі)
        </a>
      </div>

      <p className="text-[10px] text-slate-500">
        Показано {filtered.length} з {campaigns.length}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-[var(--enver-card)] px-4 py-8 text-center text-[11px] text-slate-500">
          Нічого не знайдено — змініть фільтри.
        </div>
      ) : (
        <DataTableShell
          columns={[
            "Кампанія",
            "Статус",
            "Ціль",
            "Бюджет / день",
            "Витрати (період)",
            "Ліди",
            "CPL",
            "Канал",
          ]}
        >
          {filtered.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 text-slate-700">
              <td className="px-3 py-2 font-medium">{c.name}</td>
              <td className="px-3 py-2">
                <TargetStatusPill status={c.status} />
              </td>
              <td className="px-3 py-2 text-slate-600">{c.objective}</td>
              <td className="px-3 py-2">{formatUah(c.budgetDailyUah)}</td>
              <td className="px-3 py-2">{formatUah(c.spendUah)}</td>
              <td className="px-3 py-2">{c.leads}</td>
              <td className="px-3 py-2">
                {c.cplUah != null ? formatUah(c.cplUah) : "—"}
              </td>
              <td className="px-3 py-2 text-slate-600">{c.channel}</td>
            </tr>
          ))}
        </DataTableShell>
      )}
    </div>
  );
}
