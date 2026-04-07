"use client";

import { useMemo, useState } from "react";
import { Image, Video, Layers } from "lucide-react";
import type { DemoCreative } from "../types";

function CreativeKindIcon({ kind }: { kind: "image" | "video" | "carousel" }) {
  if (kind === "video") return <Video className="h-8 w-8 text-slate-400" />;
  if (kind === "carousel")
    return <Layers className="h-8 w-8 text-slate-400" />;
  return <Image className="h-8 w-8 text-slate-400" />;
}

const STATUS_OPTS: Array<{ value: "" | DemoCreative["status"]; label: string }> = [
  { value: "", label: "Усі" },
  { value: "winner", label: "Переможці" },
  { value: "testing", label: "У тесті" },
  { value: "paused", label: "Пауза" },
];

export function TargetCreativesGrid({ creatives }: { creatives: DemoCreative[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | DemoCreative["status"]>("");

  const filtered = useMemo(() => {
    return creatives.filter((c) => {
      if (status && c.status !== status) return false;
      const qq = q.trim().toLowerCase();
      if (!qq) return true;
      return (
        c.title.toLowerCase().includes(qq) ||
        c.campaignName.toLowerCase().includes(qq)
      );
    });
  }, [creatives, q, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1 space-y-1">
          <label className="text-[10px] font-medium text-slate-500">Пошук</label>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Назва, кампанія…"
            className="w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] outline-none focus:border-slate-900"
          />
        </div>
        <div className="w-full min-w-[120px] max-w-[180px] space-y-1 sm:w-auto">
          <label className="text-[10px] font-medium text-slate-500">Статус</label>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "" | DemoCreative["status"])
            }
            className="w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-[11px] outline-none focus:border-slate-900"
          >
            {STATUS_OPTS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="flex flex-col rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3 shadow-sm"
          >
            <div className="flex h-28 items-center justify-center rounded-lg bg-slate-100">
              <CreativeKindIcon kind={c.kind} />
            </div>
            <p className="mt-2 text-[11px] font-semibold text-[var(--enver-text)]">{c.title}</p>
            <p className="text-[10px] text-slate-500">{c.campaignName}</p>
            <p className="mt-2 text-[10px] text-slate-600">
              Статус:{" "}
              <span className="font-medium">
                {c.status === "winner"
                  ? "Переможець"
                  : c.status === "testing"
                    ? "Тест"
                    : "Пауза"}
              </span>
            </p>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-[11px] text-slate-500">Нічого не знайдено.</p>
      )}
    </div>
  );
}
