"use client";

import { useMemo, useState } from "react";
import { DataTableShell } from "../../../components/shared/DataTableShell";
import type { DemoAdSet } from "../types";
import { formatUah } from "../format";
import { TargetStatusPill } from "./TargetStatusPill";

export function TargetAdsetsTable({ adsets }: { adsets: DemoAdSet[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return adsets;
    return adsets.filter(
      (r) =>
        r.name.toLowerCase().includes(qq) ||
        r.campaignName.toLowerCase().includes(qq),
    );
  }, [adsets, q]);

  return (
    <div className="space-y-3">
      <div className="max-w-md space-y-1">
        <label className="text-[10px] font-medium text-slate-500">Пошук</label>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Набір або кампанія…"
          className="w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] outline-none focus:border-slate-900"
        />
      </div>
      <DataTableShell
        columns={[
          "Набір",
          "Кампанія",
          "Статус",
          "Витрати",
          "Покази",
          "Кліки",
          "Ліди",
        ]}
      >
        {filtered.map((r) => (
          <tr key={r.id} className="border-t border-slate-100 text-slate-700">
            <td className="px-3 py-2 font-medium">{r.name}</td>
            <td className="px-3 py-2 text-slate-600">{r.campaignName}</td>
            <td className="px-3 py-2">
              <TargetStatusPill status={r.status} />
            </td>
            <td className="px-3 py-2">{formatUah(r.spendUah)}</td>
            <td className="px-3 py-2">{r.impressions.toLocaleString("uk-UA")}</td>
            <td className="px-3 py-2">{r.clicks.toLocaleString("uk-UA")}</td>
            <td className="px-3 py-2">{r.leads}</td>
          </tr>
        ))}
      </DataTableShell>
    </div>
  );
}
