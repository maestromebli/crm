"use client";

import { useState } from "react";

const btnGhost =
  "rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-[var(--enver-hover)]";

type Hit = {
  id: string;
  label: string;
  hint?: string;
  unit?: string;
  unitPrice?: number;
  providerKey?: string;
};

export function MaterialSearchCard() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    const query = q.trim();
    if (!query) {
      setHits([]);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(
        `/api/materials/search?q=${encodeURIComponent(query)}&limit=8`,
      );
      const j = (await r.json()) as { items?: Hit[] };
      if (r.ok) setHits(j.items ?? []);
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-4 shadow-sm">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Матеріали / каталог
      </h3>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
        Пошук по коду, назві, постачальнику (для подальшого застосування в сметі).
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
          placeholder="Viyar, Egger…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-xs"
        />
        <button type="button" className={btnGhost} disabled={busy} onClick={() => void search()}>
          {busy ? "…" : "Пошук"}
        </button>
      </div>
      {hits.length > 0 ? (
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[10px]">
          {hits.map((h) => (
            <li
              key={h.id}
              className="rounded border border-slate-100 bg-slate-50 px-2 py-1"
            >
              <span className="font-medium text-slate-800">{h.label}</span>
              {h.unitPrice != null ? (
                <span className="text-slate-600">
                  {" "}
                  · {h.unitPrice.toLocaleString("uk-UA")} грн
                </span>
              ) : null}
              {h.providerKey ? (
                <span className="ml-1 text-slate-400">({h.providerKey})</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
