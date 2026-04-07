"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
};

/** Прогрес по стадіях воронки + зміна поточної стадії. */
export function DealStageProgress({ data }: Props) {
  const router = useRouter();
  const { stages, stage } = data;
  const currentOrder = stage.sortOrder;
  const [selectId, setSelectId] = useState(stage.id);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);

  useEffect(() => {
    setSelectId(stage.id);
  }, [stage.id]);

  const applyStage = useCallback(async () => {
    if (selectId === stage.id) return;
    setErr(null);
    setBlockers([]);
    setSaving(true);
    try {
      const r = await fetch(`/api/deals/${data.deal.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: selectId }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        blockers?: string[];
      };
      if (!r.ok) {
        setBlockers(Array.isArray(j.blockers) ? j.blockers : []);
        throw new Error(j.error ?? "Не вдалося змінити стадію");
      }
      router.refresh();
    } catch (e) {
      if (
        typeof e === "object" &&
        e &&
        "message" in e &&
        typeof (e as { message?: string }).message === "string"
      ) {
        setErr((e as { message: string }).message);
      } else {
        setErr("Помилка");
      }
    } finally {
      setSaving(false);
    }
  }, [data.deal.id, router, selectId, stage.id]);

  const applyNext = useCallback(async () => {
    setErr(null);
    setBlockers([]);
    setSaving(true);
    try {
      const r = await fetch(`/api/deals/${data.deal.id}/stage/next`, {
        method: "POST",
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        blockers?: string[];
        message?: string;
      };
      if (!r.ok) {
        setBlockers(Array.isArray(j.blockers) ? j.blockers : []);
        throw new Error(j.error ?? "Перехід заблоковано");
      }
      if (j.message) {
        setErr(j.message);
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  }, [data.deal.id, router]);

  return (
    <div className="rounded-lg border border-slate-200/90 bg-[var(--enver-card)] px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
          Воронка: {data.pipeline.name}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void applyNext()}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition",
              "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700",
              saving && "opacity-60",
            )}
          >
            Наступний крок
          </button>
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="whitespace-nowrap">Стадія:</span>
            <select
              value={selectId}
              onChange={(e) => setSelectId(e.target.value)}
              className="max-w-[200px] rounded border border-slate-200 bg-[var(--enver-bg)] px-2 py-1 text-[11px] font-medium text-slate-800 sm:max-w-xs"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={saving || selectId === stage.id}
            onClick={() => void applyStage()}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition",
              selectId === stage.id
                ? "cursor-default border-slate-100 text-slate-400"
                : "border-[#2563eb] bg-[#2563eb] text-white shadow-sm hover:bg-[#1d4ed8]",
              saving && "opacity-60",
            )}
          >
            {saving ? "Збереження…" : "Застосувати"}
          </button>
        </div>
      </div>
      {err ? (
        <p className="mb-2 text-[11px] text-rose-700">{err}</p>
      ) : null}
      {blockers.length > 0 ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
          <p className="font-semibold">Flow checklist не виконано:</p>
          <ul className="mt-1 space-y-0.5">
            {blockers.map((b) => (
              <li key={b}>- {b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex w-full overflow-hidden rounded-md border border-slate-200/90 bg-slate-200/90 p-px">
        {stages.map((s, i) => {
          const reached = s.sortOrder <= currentOrder;
          const active = s.id === stage.id;
          return (
            <div
              key={s.id}
              className={cn(
                "relative min-w-0 flex-1 skew-x-[-10deg] py-2.5 pl-6 pr-5 first:pl-8 last:pr-8",
                active
                  ? "bg-emerald-500 text-white shadow-inner"
                  : reached
                    ? "bg-slate-300 text-slate-800"
                    : "bg-slate-100 text-slate-500",
                i > 0 && "-ml-px border-l border-white/40",
              )}
            >
              <span className="block skew-x-[10deg] truncate text-center text-[10px] font-semibold uppercase tracking-wide">
                {s.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
