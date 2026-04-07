"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import {
  derivePaymentMoneySummaryForPayload,
  getEffectivePaymentMilestones,
} from "../../features/deal-workspace/payment-aggregate";
import { parseProposalSnapshot } from "../../lib/leads/proposal-snapshot";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
  onTab: (id: DealWorkspaceTabId) => void;
};

const card =
  "rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-4 py-3 text-xs shadow-sm shadow-slate-900/5";

async function patchWorkspaceMeta(
  dealId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const r = await fetch(`/api/deals/${dealId}/workspace-meta`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(j.error ?? "Помилка збереження");
}

export function DealWorkspaceExecutionBlocks({ data, onTab }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const snap = data.commercialSnapshot;
  const snapTotal = useMemo(() => {
    if (!snap?.snapshotJson) return null;
    const p = parseProposalSnapshot(snap.snapshotJson);
    return p?.total ?? null;
  }, [snap]);

  const pay = derivePaymentMoneySummaryForPayload(data);
  const milestones = getEffectivePaymentMilestones(data);

  const tech = data.meta.technicalChecklist ?? {};
  const techKeys = [
    {
      k: "finalDimensionsConfirmed" as const,
      label: "Фінальні розміри підтверджено",
    },
    { k: "materialsConfirmed" as const, label: "Матеріали підтверджено" },
    { k: "fittingsConfirmed" as const, label: "Фурнітура підтверджено" },
    { k: "drawingsAttached" as const, label: "Креслення додано" },
    {
      k: "clientApprovalsConfirmed" as const,
      label: "Погодження клієнта зафіксовано",
    },
    {
      k: "specialNotesDocumented" as const,
      label: "Особливі нотатки задокументовано",
    },
  ];

  const toggleTech = useCallback(
    async (key: (typeof techKeys)[number]["k"]) => {
      setBusy(true);
      setErr(null);
      try {
        await patchWorkspaceMeta(data.deal.id, {
          technicalChecklist: {
            ...data.meta.technicalChecklist,
            [key]: !tech[key],
          },
        });
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Помилка");
      } finally {
        setBusy(false);
      }
    },
    [data.deal.id, data.meta.technicalChecklist, tech, router],
  );

  const toggleMilestone = useCallback(
    async (id: string, done: boolean) => {
      setBusy(true);
      setErr(null);
      try {
        const r = await fetch(
          `/api/deals/${data.deal.id}/payment-milestones`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ milestoneId: id, confirmed: !done }),
          },
        );
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Помилка");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Помилка");
      } finally {
        setBusy(false);
      }
    },
    [data.deal.id, router],
  );

  const cm = data.controlMeasurement;

  return (
    <div className="space-y-3">
      {err ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Узгоджене КП (знімок)
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Дані з погодженої пропозиції; зміна умов — лише через нову версію
              КП або узгоджений перегляд.
            </p>
          </div>
          {data.leadId ? (
            <button
              type="button"
              onClick={() => onTab("estimate")}
              className="text-[11px] font-medium text-indigo-700 underline"
            >
              Смета / історія
            </button>
          ) : null}
        </div>
        {snap ? (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Сума (знімок)</dt>
              <dd className="font-semibold text-[var(--enver-text)]">
                {snapTotal != null
                  ? `${snapTotal.toLocaleString("uk-UA")} (за КП)`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Зафіксовано</dt>
              <dd className="text-slate-800">
                {format(new Date(snap.frozenAt), "d MMM yyyy, HH:mm", {
                  locale: uk,
                })}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-slate-600">
            Знімок КП ще не збережено в угоді (наприклад, угода без конверсії з
            погодженого КП). Суму та умови можна вести вручну в шапці.
          </p>
        )}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Оплата та віхи
          </h2>
          <button
            type="button"
            onClick={() => onTab("payment")}
            className="text-[11px] font-medium text-slate-700 underline"
          >
            Детальніше у вкладці «Оплата»
          </button>
        </div>
        {pay.hasNumeric ? (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-slate-500">Загалом</p>
              <p className="font-bold text-[var(--enver-text)]">
                {pay.total.toLocaleString("uk-UA")} {pay.currency ?? ""}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-700">Оплачено</p>
              <p className="font-bold text-emerald-900">
                {pay.paid.toLocaleString("uk-UA")}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-amber-800">Залишок</p>
              <p className="font-bold text-amber-950">
                {pay.remaining.toLocaleString("uk-UA")}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-slate-600">Віхи оплати не задані.</p>
        )}
        {milestones.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-slate-100 pt-2">
            {milestones.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span
                  className={cn(
                    m.done ? "text-emerald-800" : "text-slate-800",
                    "font-medium",
                  )}
                >
                  {m.label}
                  {m.amount != null
                    ? ` · ${m.amount.toLocaleString("uk-UA")} ${m.currency ?? ""}`
                    : ""}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleMilestone(m.id, m.done)}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[11px] font-medium",
                    m.done
                      ? "border border-slate-200 bg-[var(--enver-card)] text-slate-600"
                      : "bg-emerald-600 text-white hover:bg-emerald-700",
                  )}
                >
                  {m.done ? "Скасувати оплату" : "Підтвердити оплату"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={card}>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Контрольний замір
        </h2>
        <p className="mt-1 text-[11px] text-slate-600">
          Планування та результат контрольного заміру після підпису та оплат.
        </p>
        <div className="mt-2 space-y-2">
          <p className="text-slate-800">
            {cm?.scheduledAt
              ? `Заплановано: ${format(new Date(cm.scheduledAt), "d MMM yyyy, HH:mm", { locale: uk })}`
              : "Дата не запланована"}
          </p>
          <p className="text-slate-800">
            {cm?.completedAt
              ? `Завершено: ${format(new Date(cm.completedAt), "d MMM yyyy, HH:mm", { locale: uk })}`
              : "Результат не зафіксовано"}
          </p>
          {cm?.mismatchDetected ? (
            <p className="rounded-lg bg-amber-50 px-2 py-1 text-amber-950">
              Виявлено розбіжності — потрібен перегляд прорахунку.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onTab("measurement")}
          className="mt-2 text-[11px] font-medium text-sky-800 underline"
        >
          Відкрити блок заміру
        </button>
      </section>

      <section className={card}>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Технічний чеклист (виробництво)
        </h2>
        <ul className="mt-2 space-y-1.5">
          {techKeys.map(({ k, label }) => (
            <li key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`tech-${k}`}
                checked={Boolean(tech[k])}
                disabled={busy}
                onChange={() => void toggleTech(k)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor={`tech-${k}`} className="text-slate-800">
                {label}
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
