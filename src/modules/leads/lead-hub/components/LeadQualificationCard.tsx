"use client";

import { useCallback, useEffect, useState } from "react";
import { useLeadMutationActions } from "../../../../features/leads/use-lead-mutation-actions";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import type { LeadQualification } from "../../../../lib/leads/lead-qualification";

type Props = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
};

export function LeadQualificationCard({ lead, canUpdateLead }: Props) {
  const leadActions = useLeadMutationActions(lead.id);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState<LeadQualification>(lead.qualification);
  const [err, setErr] = useState<string | null>(null);
  const saving = leadActions.isPending;

  useEffect(() => {
    setQ(lead.qualification);
  }, [lead.qualification, lead.updatedAt]);

  const savePatch = useCallback(
    async (patch: Partial<LeadQualification>) => {
      if (!canUpdateLead) return;
      setErr(null);
      try {
        const next = { ...q, ...patch };
        await leadActions.patch({ qualification: next });
        setQ(next);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Помилка");
      }
    },
    [canUpdateLead, leadActions, q],
  );

  const tempUa: Record<string, string> = {
    cold: "Холодний",
    warm: "Теплий",
    hot: "Гарячий",
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h3 className="text-xs font-semibold text-[var(--enver-text)]">Кваліфікація</h3>
        <dl className="mt-2 space-y-1 text-[11px]">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Проєкт</dt>
            <dd className="text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.furnitureType?.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Обʼєкт</dt>
            <dd className="text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.objectType?.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Бюджет</dt>
            <dd className="text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.budgetRange?.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Терміни</dt>
            <dd className="text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.timeline?.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Температура</dt>
            <dd className="text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.temperature
                ? tempUa[lead.qualification.temperature] ?? lead.qualification.temperature
                : "—"}
            </dd>
          </div>
        </dl>
        {canUpdateLead ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-800 hover:bg-[var(--enver-hover)]"
          >
            Редагувати кваліфікацію
          </button>
        ) : null}
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col bg-[var(--enver-card)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h4 className="text-sm font-semibold text-[var(--enver-text)]">
                Кваліфікація
              </h4>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Закрити
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {err ? (
                <p className="mb-2 text-xs text-rose-700">{err}</p>
              ) : null}
              <div className="grid gap-2 text-xs">
                <label>
                  <span className="text-slate-500">Тип меблів</span>
                  <input
                    value={q.furnitureType ?? ""}
                    disabled={saving}
                    onChange={(e) => setQ({ ...q, furnitureType: e.target.value })}
                    onBlur={() => void savePatch({ furnitureType: q.furnitureType })}
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
                  />
                </label>
                <label>
                  <span className="text-slate-500">Обʼєкт</span>
                  <input
                    value={q.objectType ?? ""}
                    disabled={saving}
                    onChange={(e) => setQ({ ...q, objectType: e.target.value })}
                    onBlur={() => void savePatch({ objectType: q.objectType })}
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
                  />
                </label>
                <label>
                  <span className="text-slate-500">Бюджет</span>
                  <input
                    value={q.budgetRange ?? ""}
                    disabled={saving}
                    onChange={(e) => setQ({ ...q, budgetRange: e.target.value })}
                    onBlur={() => void savePatch({ budgetRange: q.budgetRange })}
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
                  />
                </label>
                <label>
                  <span className="text-slate-500">Терміни</span>
                  <input
                    value={q.timeline ?? ""}
                    disabled={saving}
                    onChange={(e) => setQ({ ...q, timeline: e.target.value })}
                    onBlur={() => void savePatch({ timeline: q.timeline })}
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
                  />
                </label>
                <label>
                  <span className="text-slate-500">Температура</span>
                  <select
                    value={q.temperature ?? ""}
                    disabled={saving}
                    onChange={(e) => {
                      const v = e.target.value as LeadQualification["temperature"];
                      const next = { ...q, temperature: v || null };
                      setQ(next);
                      void savePatch({ temperature: next.temperature });
                    }}
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
                  >
                    <option value="">—</option>
                    <option value="cold">Холодний</option>
                    <option value="warm">Теплий</option>
                    <option value="hot">Гарячий</option>
                  </select>
                </label>
                <label>
                  <span className="text-slate-500">Статус рішення</span>
                  <input
                    value={q.decisionStatus ?? ""}
                    disabled={saving}
                    onChange={(e) => setQ({ ...q, decisionStatus: e.target.value })}
                    onBlur={() =>
                      void savePatch({ decisionStatus: q.decisionStatus })
                    }
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
                  />
                </label>
                <label>
                  <span className="text-slate-500">Потреби клієнта</span>
                  <textarea
                    value={q.needsSummary ?? ""}
                    disabled={saving}
                    onChange={(e) => setQ({ ...q, needsSummary: e.target.value })}
                    onBlur={() =>
                      void savePatch({ needsSummary: q.needsSummary })
                    }
                    rows={3}
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
