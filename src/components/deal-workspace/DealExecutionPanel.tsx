"use client";

import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DealWorkspaceMeta,
  DealWorkspacePayload,
} from "../../features/deal-workspace/types";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { derivePaymentStripSummaryForPayload } from "../../features/deal-workspace/payment-aggregate";
import { useDealMutationActions } from "../../features/deal-workspace/use-deal-mutation-actions";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
  onTab: (id: DealWorkspaceTabId) => void;
};

const CHECK_DEF: Array<{
  key: keyof NonNullable<DealWorkspaceMeta["executionChecklist"]>;
  label: string;
}> = [
  { key: "contactConfirmed", label: "Контакт підтверджено" },
  { key: "estimateApproved", label: "Смета погоджена" },
  { key: "contractCreated", label: "Договір створено" },
  { key: "contractSigned", label: "Договір підписано" },
  { key: "prepaymentReceived", label: "Аванс отримано" },
  { key: "productionStarted", label: "Запущено виробництво" },
  { key: "installationScheduled", label: "Монтаж заплановано" },
];

export function DealExecutionPanel({ data, onTab }: Props) {
  const dealActions = useDealMutationActions(data.deal.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checklistState, setChecklistState] = useState<
    NonNullable<DealWorkspaceMeta["executionChecklist"]>
  >(data.meta.executionChecklist ?? {});

  const checklist = checklistState;
  const pay = derivePaymentStripSummaryForPayload(data);
  const contract = data.contract;

  useEffect(() => {
    setChecklistState(data.meta.executionChecklist ?? {});
  }, [data.meta.executionChecklist]);

  const toggleCheck = useCallback(
    async (
      key: keyof NonNullable<DealWorkspaceMeta["executionChecklist"]>,
    ) => {
      setBusy(true);
      setErr(null);
      const prevChecklist = checklistState;
      const next: NonNullable<DealWorkspaceMeta["executionChecklist"]> = {
        ...checklistState,
        [key]: !checklistState[key],
      };
      setChecklistState(next);
      try {
        await dealActions.patchWorkspaceMeta({ executionChecklist: next });
      } catch (e) {
        setChecklistState(prevChecklist);
        setErr(e instanceof Error ? e.message : "Помилка");
      } finally {
        setBusy(false);
      }
    },
    [checklistState, dealActions],
  );

  const leadHref = data.leadId ? `/leads/${data.leadId}` : null;

  const messages = useMemo(() => data.leadMessagesPreview, [data.leadMessagesPreview]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--enver-text)]">
              Виконання (чеклист)
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Позначайте етапи — це орієнтир для команди та керівництва.
            </p>
          </div>
          {data.productionManager ? (
            <p className="text-right text-[11px] text-slate-600">
              <span className="text-slate-400">Виробництво:</span>{" "}
              <span className="font-medium text-slate-800">
                {data.productionManager.name ?? data.productionManager.email}
              </span>
            </p>
          ) : null}
        </div>
        {err ? (
          <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-800">
            {err}
          </p>
        ) : null}
        <ul className="mt-3 space-y-1.5">
          {CHECK_DEF.map(({ key, label }) => {
            const done = Boolean(checklist[key]);
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleCheck(key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition",
                    done
                      ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                      : "border-slate-100 bg-slate-50/80 text-slate-800 hover:bg-slate-100",
                  )}
                >
                  <span className="text-base" aria-hidden>
                    {done ? "✔" : "❌"}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Оплата</h2>
        <p className={cn("mt-1 text-xs", pay.variant === "complete" ? "text-emerald-800" : "text-slate-600")}>
          {pay.label}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTab("payment")}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white"
          >
            Додати / віхи
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Договір</h2>
        <p className="mt-1 text-xs text-slate-600">
          Статус:{" "}
          <span className="font-medium text-[var(--enver-text)]">
            {contract ? contract.status : "немає запису"}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTab("contract")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-800"
          >
            Генерувати / надіслати
          </button>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500">
            Підпис (Diia) — згодом
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Виробництво / монтаж</h2>
        <p className="mt-1 text-xs text-slate-600">
          Дата монтажу:{" "}
          {data.installationDate
            ? format(new Date(data.installationDate), "d MMM yyyy", {
                locale: uk,
              })
            : "не задано"}
        </p>
        <button
          type="button"
          onClick={() => onTab("production")}
          className="mt-2 text-[11px] font-medium text-[var(--enver-text)] underline"
        >
          Деталі виробництва
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Комунікація (лід + угода)
          </h2>
          {leadHref ? (
            <Link
              href={leadHref}
              className="text-[11px] font-medium text-emerald-800 underline"
            >
              Картка ліда
            </Link>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Історія з ліда підтягується за посиланням; нотатки по угоді — у вкладці
          «Повідомлення».
        </p>
        {messages.length > 0 ? (
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-[11px] text-slate-700">
            {messages.slice(-12).map((m) => (
              <li key={m.id} className="border-b border-slate-100 pb-2 last:border-0">
                <span className="text-slate-400">
                  {format(new Date(m.createdAt), "d MMM HH:mm", { locale: uk })} ·{" "}
                  {m.interactionKind}
                </span>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Немає повідомлень з ліда або лід не прив’язаний.
          </p>
        )}
        <button
          type="button"
          onClick={() => onTab("messages")}
          className="mt-3 text-[11px] font-medium text-[var(--enver-text)] underline"
        >
          Повідомлення по угоді
        </button>
      </section>
    </div>
  );
}
