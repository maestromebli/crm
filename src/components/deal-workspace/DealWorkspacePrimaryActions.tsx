"use client";

import { useCallback, useEffect, useState } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { useDealMutationActions } from "../../features/deal-workspace/use-deal-mutation-actions";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
  onTab: (id: DealWorkspaceTabId) => void;
  onRequestEditHeader: () => void;
};

const pill =
  "inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition";

export function DealWorkspacePrimaryActions({
  data,
  onTab,
  onRequestEditHeader,
}: Props) {
  const dealActions = useDealMutationActions(data.deal.id);
  const [localStatus, setLocalStatus] = useState(data.deal.status);
  const tel = data.primaryContact?.phone?.replace(/\s+/g, "") ?? "";
  const canAct = localStatus === "OPEN" || localStatus === "ON_HOLD";

  useEffect(() => {
    setLocalStatus(data.deal.status);
  }, [data.deal.status]);

  const patchStatus = useCallback(
    async (status: "WON" | "LOST") => {
      if (
        !confirm(
          status === "WON"
            ? "Позначити угоду як виграну?"
            : "Позначити угоду як втрачену?",
        )
      ) {
        return;
      }
      const prevStatus = localStatus;
      setLocalStatus(status);
      try {
        await dealActions.updateStatus(status);
      } catch (e) {
        setLocalStatus(prevStatus);
        alert(e instanceof Error ? e.message : "Помилка");
      }
    },
    [dealActions, localStatus],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2 shadow-sm shadow-slate-900/5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Дії
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tel ? (
          <a
            href={`tel:${tel}`}
            className={cn(pill, "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100")}
          >
            Дзвінок
          </a>
        ) : (
          <span
            className={cn(pill, "cursor-not-allowed border-slate-100 text-slate-400")}
            title="Немає телефону в основному контакті"
          >
            Дзвінок
          </span>
        )}
        <button
          type="button"
          className={cn(pill, "border-slate-200 bg-[var(--enver-card)] text-slate-800 hover:bg-[var(--enver-hover)]")}
          onClick={() => onTab("messages")}
        >
          Повідомлення
        </button>
        <button
          type="button"
          className={cn(pill, "border-slate-200 bg-[var(--enver-card)] text-slate-800 hover:bg-[var(--enver-hover)]")}
          onClick={() => onTab("tasks")}
        >
          Задача
        </button>
        <button
          type="button"
          className={cn(pill, "border-sky-200 bg-sky-50 text-sky-950 hover:bg-sky-100")}
          onClick={onRequestEditHeader}
        >
          Наступний крок
        </button>
        <button
          type="button"
          className={cn(pill, "border-slate-200 bg-[var(--enver-card)] text-slate-800 hover:bg-[var(--enver-hover)]")}
          onClick={() => onTab("estimate")}
        >
          Смета
        </button>
        <button
          type="button"
          className={cn(pill, "border-slate-200 bg-[var(--enver-card)] text-slate-800 hover:bg-[var(--enver-hover)]")}
          onClick={() => onTab("proposal")}
        >
          КП
        </button>
        <button
          type="button"
          className={cn(pill, "border-slate-200 bg-[var(--enver-card)] text-slate-800 hover:bg-[var(--enver-hover)]")}
          onClick={() => onTab("contract")}
        >
          Договір
        </button>
        <button
          type="button"
          className={cn(pill, "border-slate-200 bg-[var(--enver-card)] text-slate-800 hover:bg-[var(--enver-hover)]")}
          onClick={() => onTab("payment")}
        >
          Оплата
        </button>
        <button
          type="button"
          disabled={dealActions.isStatusPending || !canAct}
          className={cn(
            pill,
            "border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40",
          )}
          onClick={() => void patchStatus("WON")}
        >
          Виграно
        </button>
        <button
          type="button"
          disabled={dealActions.isStatusPending || !canAct}
          className={cn(
            pill,
            "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100 disabled:opacity-40",
          )}
          onClick={() => void patchStatus("LOST")}
        >
          Втрачено
        </button>
      </div>
    </div>
  );
}
