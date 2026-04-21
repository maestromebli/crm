"use client";

import { useState } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { useDealMutationActions } from "../../features/deal-workspace/use-deal-mutation-actions";
import { canSyncDealValueFromLatestEstimate } from "../../features/deal-workspace/deal-workspace-warnings";
import { cn } from "../../lib/utils";

const BTN_DARK =
  "inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50";
const BTN_AMBER =
  "inline-flex items-center justify-center rounded-lg border border-amber-800/60 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200/90 disabled:opacity-50";

type Props = {
  data: DealWorkspacePayload;
  className?: string;
  /** На світлому фоні (наприклад попередження про суму). */
  tone?: "dark" | "amber";
  /** Короткий підпис для шапки замовлення. */
  label?: "full" | "short";
};

export function SyncDealValueFromEstimateButton({
  data,
  className,
  tone = "dark",
  label = "full",
}: Props) {
  const dealActions = useDealMutationActions(data.deal.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const est = data.operationalStats.latestEstimate;
  const show = canSyncDealValueFromLatestEstimate(data) && est?.totalPrice != null;

  if (!show) return null;

  const sync = async () => {
    if (est?.totalPrice == null) return;
    setBusy(true);
    setErr(null);
    try {
      await dealActions.patchDeal({ value: est.totalPrice });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        className={cn(
          tone === "amber" ? BTN_AMBER : BTN_DARK,
          label === "short" && "max-w-[14rem] truncate px-2 py-1 text-[11px]",
        )}
        disabled={busy}
        onClick={() => void sync()}
        title={
          label === "short"
            ? `Підставити ${est.totalPrice!.toLocaleString("uk-UA")} грн з смети v${est.version}`
            : undefined
        }
      >
        {busy
          ? "Оновлення…"
          : label === "short"
            ? `Сума з смети v${est.version}`
            : `Підставити суму замовлення з смети v${est.version} (${est.totalPrice!.toLocaleString("uk-UA")} грн)`}
      </button>
      {err ? <p className="text-xs text-rose-700">{err}</p> : null}
    </div>
  );
}
