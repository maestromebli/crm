"use client";

import { useMemo, useState } from "react";
import { DataTableShell } from "../../../components/shared/DataTableShell";
import type { DemoAdRow } from "../types";
import { formatUah } from "../format";

export function TargetAdsTable({ ads }: { ads: DemoAdRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return ads;
    return ads.filter(
      (r) =>
        r.headline.toLowerCase().includes(qq) ||
        r.campaignName.toLowerCase().includes(qq) ||
        r.adSetName.toLowerCase().includes(qq),
    );
  }, [ads, q]);

  return (
    <div className="space-y-3">
      <div className="max-w-md space-y-1">
        <label className="text-[10px] font-medium text-slate-500">Пошук</label>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Заголовок, кампанія…"
          className="w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] outline-none focus:border-slate-900"
        />
      </div>
      <DataTableShell
        columns={[
          "Заголовок",
          "Кампанія",
          "Набір",
          "CTR %",
          "CPC",
          "Витрати",
          "Ліди",
        ]}
      >
        {filtered.map((r) => (
          <tr key={r.id} className="border-t border-slate-100 text-slate-700">
            <td className="px-3 py-2 font-medium">{r.headline}</td>
            <td className="px-3 py-2 text-slate-600">{r.campaignName}</td>
            <td className="px-3 py-2 text-slate-600">{r.adSetName}</td>
            <td className="px-3 py-2">{r.ctr.toFixed(1)}</td>
            <td className="px-3 py-2">{formatUah(r.cpcUah)}</td>
            <td className="px-3 py-2">{formatUah(r.spendUah)}</td>
            <td className="px-3 py-2">{r.leads}</td>
          </tr>
        ))}
      </DataTableShell>
    </div>
  );
}
