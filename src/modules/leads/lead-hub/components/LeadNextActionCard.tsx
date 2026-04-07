"use client";

import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { uk } from "date-fns/locale";
import { useCallback, useEffect, useState } from "react";
import { useLeadMutationActions } from "../../../../features/leads/use-lead-mutation-actions";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { dateToNextStepDateString } from "../../../../lib/leads/next-step-date";
import { cn } from "../../../../lib/utils";

const NEXT_STEP_PRESETS = [
  "Передзвонити клієнту",
  "Надіслати КП",
  "Узгодити замір",
  "Чекаємо відповіді від клієнта",
] as const;

type Props = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
};

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function LeadNextActionCard({
  lead,
  canUpdateLead,
}: Props) {
  const leadActions = useLeadMutationActions(lead.id);
  const [nextStep, setNextStep] = useState(lead.nextStep ?? "");
  const [nextStepDate, setNextStepDate] = useState(
    () => dateToNextStepDateString(lead.nextContactAt) ?? "",
  );
  const [err, setErr] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const saving = leadActions.isPending;

  useEffect(() => {
    setNextStep(lead.nextStep ?? "");
    setNextStepDate(dateToNextStepDateString(lead.nextContactAt) ?? "");
  }, [lead.nextStep, lead.nextContactAt, lead.updatedAt]);

  const risk = (() => {
    if (!lead.nextContactAt) return "none" as const;
    const d = new Date(lead.nextContactAt);
    const dayStart = startOfDay(d);
    const todayStart = startOfDay(new Date());
    if (dayStart < todayStart) return "overdue" as const;
    if (isSameDay(d, new Date())) return "today" as const;
    return "future" as const;
  })();

  const save = useCallback(async () => {
    if (!canUpdateLead) return;
    setErr(null);
    try {
      await leadActions.updateNextStep({
        nextStep: nextStep.trim() || null,
        nextStepDate: nextStepDate.trim() || null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  }, [canUpdateLead, leadActions, nextStep, nextStepDate]);

  const markDone = async () => {
    if (!canUpdateLead) return;
    setErr(null);
    try {
      await leadActions.patch({
        nextStep: null,
        nextStepDate: null,
        recordTouch: true,
      });
      setNextStep("");
      setNextStepDate("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  };

  const rescheduleByDays = async (days: number) => {
    if (!canUpdateLead) return;
    const base = lead.nextContactAt
      ? new Date(lead.nextContactAt)
      : new Date();
    const next = addDays(startOfDay(base), days);
    setErr(null);
    try {
      await leadActions.patch({ nextStepDate: toYmd(next) });
      setNextStepDate(toYmd(next));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  };

  const btn =
    "rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-[var(--enver-hover)] disabled:opacity-50";
  const btnDark =
    "rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50";

  return (
    <section
      id="lead-next-action"
      className="scroll-mt-28 rounded-2xl border-2 border-slate-900/10 bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Наступна дія
          </h3>
          <p className="mt-1 text-base font-semibold text-[var(--enver-text)]">
            {lead.nextStep?.trim() || "Заплануйте крок або дату контакту"}
          </p>
          {lead.nextContactAt ? (
            <p className="mt-0.5 text-xs text-slate-600">
              До{" "}
              {format(new Date(lead.nextContactAt), "d MMMM yyyy", {
                locale: uk,
              })}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
            risk === "overdue" && "bg-rose-100 text-rose-900",
            risk === "today" && "bg-amber-100 text-amber-900",
            risk === "future" && "bg-emerald-50 text-emerald-900",
            risk === "none" && "bg-slate-100 text-slate-600",
          )}
        >
          {risk === "overdue"
            ? "Прострочено"
            : risk === "today"
              ? "Сьогодні"
              : risk === "future"
                ? "У плані"
                : "Без дати"}
        </span>
      </div>

      {err ? (
        <p className="mt-2 text-xs text-rose-700">{err}</p>
      ) : null}

      {canUpdateLead ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Швидкий текст кроку
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {NEXT_STEP_PRESETS.map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setNextStep(label);
                    setEditOpen(true);
                  }}
                  className="rounded-full border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-[var(--enver-hover)] disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => void markDone()}
            className={btnDark}
          >
            Виконано
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void rescheduleByDays(1)}
            className={btn}
          >
            +1 д
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void rescheduleByDays(3)}
            className={btn}
          >
            +3 д
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void rescheduleByDays(7)}
            className={btn}
          >
            +7 д
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setEditOpen((o) => !o)}
            className={btn}
          >
            {editOpen ? "Згорнути" : "Змінити"}
          </button>
          </div>
        </div>
      ) : null}

      {canUpdateLead && editOpen ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <label className="block text-[11px]">
            <span className="text-slate-500">Текст кроку</span>
            <input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Напр. передзвонити з КП"
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-[11px]">
            <span className="text-slate-500">Дата контакту</span>
            <input
              type="date"
              value={nextStepDate}
              onChange={(e) => setNextStepDate(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className={btnDark}
          >
            {saving ? "Зберігаю…" : "Зберегти"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
