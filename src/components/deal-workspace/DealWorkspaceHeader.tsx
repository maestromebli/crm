"use client";

import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useCallback, useEffect, useState } from "react";
import type { DealWorkspaceMeta } from "../../features/deal-workspace/types";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { deriveNextStepSeverity } from "../../features/deal-workspace/insights";
import {
  useDealMutationActions,
  type FinancialWorkflowResult,
} from "../../features/deal-workspace/use-deal-mutation-actions";
import {
  derivePaymentMoneySummaryForPayload,
  derivePaymentStripSummaryForPayload,
} from "../../features/deal-workspace/payment-aggregate";
import { cn } from "../../lib/utils";
import { SyncDealValueFromEstimateButton } from "./SyncDealValueFromEstimateButton";

type Props = {
  data: DealWorkspacePayload;
  nextActionLabel?: string | null;
  /** Системна підказка (окремо від поля «наступний крок» менеджера). */
  systemNextHint?: string | null;
  /** Інкремент з батьківського компонента — відкрити панель редагування. */
  openEditSignal?: number;
};

const DEAL_STATUSES = ["OPEN", "WON", "LOST", "ON_HOLD"] as const;

const NEXT_STEP_KINDS: Array<{
  value: NonNullable<DealWorkspaceMeta["nextStepKind"]>;
  label: string;
}> = [
  { value: "call", label: "Дзвінок" },
  { value: "visit", label: "Візит / замір" },
  { value: "send_quote", label: "КП" },
  { value: "follow_up", label: "Повторний контакт" },
  { value: "payment", label: "Оплата" },
  { value: "other", label: "Інше" },
];

const STEP_PRESETS: Array<{
  kind: NonNullable<DealWorkspaceMeta["nextStepKind"]>;
  label: string;
}> = [
  { kind: "call", label: "Подзвонити клієнту" },
  { kind: "visit", label: "Записати на замір" },
  { kind: "send_quote", label: "Надіслати КП" },
  { kind: "follow_up", label: "Повторний контакт після КП" },
  { kind: "payment", label: "Нагадати про оплату" },
];

export function DealWorkspaceHeader({
  data,
  nextActionLabel,
  systemNextHint,
  openEditSignal = 0,
}: Props) {
  const dealActions = useDealMutationActions(data.deal.id);
  const { deal, client, primaryContact, owner, stage, meta } = data;
  const health = meta.health ?? "ok";
  const healthClass =
    health === "blocked"
      ? "bg-rose-100 text-rose-800 border-rose-200"
      : health === "at_risk"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-emerald-100 text-emerald-900 border-emerald-200";

  const valueStr =
    deal.value != null
      ? `${deal.value.toLocaleString("uk-UA")} ${deal.currency ?? ""}`.trim()
      : "—";

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowErr, setWorkflowErr] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<FinancialWorkflowResult | null>(
    null,
  );

  const [title, setTitle] = useState(deal.title);
  const [description, setDescription] = useState(deal.description ?? "");
  const [value, setValue] = useState(
    deal.value != null ? String(deal.value) : "",
  );
  const [currency, setCurrency] = useState(deal.currency ?? "");
  const [closeDate, setCloseDate] = useState(
    deal.expectedCloseDate
      ? format(new Date(deal.expectedCloseDate), "yyyy-MM-dd")
      : "",
  );
  const [status, setStatus] = useState(deal.status);

  const [subStatusLabel, setSubStatusLabel] = useState(
    meta.subStatusLabel ?? "",
  );
  const [healthSel, setHealthSel] = useState<
    NonNullable<DealWorkspaceMeta["health"]>
  >(meta.health ?? "ok");
  const [nextActionAt, setNextActionAt] = useState(
    meta.nextActionAt
      ? format(new Date(meta.nextActionAt), "yyyy-MM-dd'T'HH:mm")
      : "",
  );
  const [nextStepLabel, setNextStepLabel] = useState(
    meta.nextStepLabel ?? "",
  );
  const [nextStepKind, setNextStepKind] = useState<
    DealWorkspaceMeta["nextStepKind"] | ""
  >(meta.nextStepKind ?? "");

  const stepSeverity = deriveNextStepSeverity(meta);
  const paymentStrip = derivePaymentStripSummaryForPayload(data);
  const paymentMoney = derivePaymentMoneySummaryForPayload(data);

  useEffect(() => {
    if (openEditSignal > 0) {
      setOpen(true);
      setErr(null);
    }
  }, [openEditSignal]);

  useEffect(() => {
    if (!open) return;
    setTitle(deal.title);
    setDescription(deal.description ?? "");
    setValue(deal.value != null ? String(deal.value) : "");
    setCurrency(deal.currency ?? "");
    setCloseDate(
      deal.expectedCloseDate
        ? format(new Date(deal.expectedCloseDate), "yyyy-MM-dd")
        : "",
    );
    setStatus(deal.status);
    setSubStatusLabel(meta.subStatusLabel ?? "");
    setHealthSel(meta.health ?? "ok");
    setNextActionAt(
      meta.nextActionAt
        ? format(new Date(meta.nextActionAt), "yyyy-MM-dd'T'HH:mm")
        : "",
    );
    setNextStepLabel(meta.nextStepLabel ?? "");
    setNextStepKind(meta.nextStepKind ?? "");
  }, [open, deal, meta]);

  const saveAll = useCallback(async () => {
    setErr(null);
    setSaving(true);
    try {
      const dealBody: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        currency: currency.trim() || null,
        status,
      };
      const v = value.trim();
      if (v === "") dealBody.value = null;
      else {
        const n = Number(v.replace(",", "."));
        if (Number.isNaN(n)) throw new Error("Некоректна сума");
        dealBody.value = n;
      }
      dealBody.expectedCloseDate = closeDate.trim() ? closeDate : null;

      await dealActions.patchDeal(dealBody);

      const metaPatch: Record<string, unknown> = {
        subStatusLabel: subStatusLabel.trim() ? subStatusLabel.trim() : null,
        health: healthSel,
        nextStepLabel: nextStepLabel.trim() ? nextStepLabel.trim() : null,
        nextStepKind:
          nextStepKind &&
          NEXT_STEP_KINDS.some((k) => k.value === nextStepKind)
            ? nextStepKind
            : null,
        nextActionAt: (() => {
          if (!nextActionAt.trim()) return null;
          const d = new Date(nextActionAt);
          if (Number.isNaN(d.getTime())) throw new Error("Некоректна дата дії");
          return d.toISOString();
        })(),
      };

      await dealActions.patchWorkspaceMeta(metaPatch);

      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  }, [
    closeDate,
    currency,
    dealActions,
    description,
    healthSel,
    nextActionAt,
    nextStepLabel,
    nextStepKind,
    status,
    subStatusLabel,
    title,
    value,
  ]);

  const runFinancialOneClick = useCallback(async () => {
    setWorkflowBusy(true);
    setWorkflowErr(null);
    try {
      const result = await dealActions.runFinancialWorkflow();
      setWorkflowResult(result);
    } catch (e) {
      setWorkflowErr(
        e instanceof Error ? e.message : "Помилка виконання one-click сценарію",
      );
    } finally {
      setWorkflowBusy(false);
    }
  }, [dealActions]);

  const payVariantClass =
    paymentStrip.variant === "complete"
      ? "text-emerald-800"
      : paymentStrip.variant === "partial"
        ? "text-amber-900"
        : paymentStrip.variant === "unpaid"
          ? "text-slate-700"
          : "text-slate-500";

  return (
    <header className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <Link href="/deals" className="hover:text-slate-800">
              Замовлення
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-700">Робоче місце</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
            {deal.title}
          </h1>
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{client.name}</span>
            {primaryContact ? (
              <>
                {" · "}
                {primaryContact.fullName}
                {primaryContact.phone ? ` · ${primaryContact.phone}` : ""}
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {data.leadId ? (
              <Link
                href={`/leads/${data.leadId}`}
                className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)]"
              >
                Вихідний лід
              </Link>
            ) : null}
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
              Стадія: {stage.name}
            </span>
            {meta.subStatusLabel ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-900">
                {meta.subStatusLabel}
              </span>
            ) : null}
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${healthClass}`}
            >
              {health === "blocked"
                ? "Блокер"
                : health === "at_risk"
                  ? "Ризик"
                  : "Ок"}
            </span>
            <button
              id="deal-workspace-edit-toggle"
              type="button"
              onClick={() => {
                setOpen((o) => !o);
                setErr(null);
              }}
              className="rounded-full border border-slate-300 bg-[var(--enver-card)] px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-[var(--enver-hover)]"
            >
              {open ? "Close" : "Редагувати дані"}
            </button>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-start gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <div className="text-right text-xs">
            <p className="text-slate-500">Відповідальний</p>
            <p className="font-medium text-[var(--enver-text)]">
              {owner.name ?? owner.email}
            </p>
          </div>
          <div className="flex flex-col items-end text-right text-xs">
            <p className="text-slate-500">Сума</p>
            <p className="font-semibold text-[var(--enver-text)]">{valueStr}</p>
            <SyncDealValueFromEstimateButton
              data={data}
              label="short"
              className="mt-1.5 items-end"
            />
            <button
              type="button"
              disabled={workflowBusy}
              onClick={() => void runFinancialOneClick()}
              className={cn(
                "mt-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-900 transition hover:bg-indigo-100",
                workflowBusy && "cursor-wait opacity-60",
              )}
            >
              {workflowBusy ? "Виконання…" : "Фінанси в один клік"}
            </button>
            {workflowErr ? (
              <p className="mt-1.5 max-w-[260px] rounded-md bg-rose-50 px-2 py-1 text-[10px] text-rose-800">
                {workflowErr}
              </p>
            ) : null}
            {workflowResult ? (
              <div className="mt-1.5 max-w-[260px] rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700">
                <p className="font-semibold">
                  {workflowResult.ok ? "Сценарій виконано" : "Сценарій виконано частково"}
                </p>
                <p>
                  Успіх: {workflowResult.summary.success} · Помилки:{" "}
                  {workflowResult.summary.failed} · Пропущено:{" "}
                  {workflowResult.summary.skipped}
                </p>
                <ul className="mt-1 space-y-0.5 border-t border-slate-200 pt-1">
                  {workflowResult.steps.map((step) => (
                    <li key={step.key}>
                      {step.status === "success"
                        ? "ОК"
                        : step.status === "failed"
                          ? "ПОМИЛКА"
                          : "ПРОПУСК"}{" "}
                      {step.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {paymentMoney.hasNumeric ? (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5 text-center shadow-sm shadow-slate-900/5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Загалом
            </p>
            <p className="mt-0.5 text-sm font-bold text-[var(--enver-text)]">
              {paymentMoney.total.toLocaleString("uk-UA")}{" "}
              {paymentMoney.currency ?? ""}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Оплачено
            </p>
            <p className="mt-0.5 text-sm font-bold text-emerald-900">
              {paymentMoney.paid.toLocaleString("uk-UA")}{" "}
              {paymentMoney.currency ?? ""}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              Залишок
            </p>
            <p className="mt-0.5 text-sm font-bold text-amber-950">
              {paymentMoney.remaining.toLocaleString("uk-UA")}{" "}
              {paymentMoney.currency ?? ""}
            </p>
          </div>
        </div>
      ) : null}

      <p
        className={`mt-2 text-[11px] font-medium ${payVariantClass}`}
        title="Підсумок по віхах у метаданих замовлення"
      >
        {paymentStrip.label}
      </p>

      {stepSeverity === "danger" ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <span className="font-semibold">Немає наступного кроку або дати.</span>{" "}
          Вкажіть конкретну дію та коли з клієнтом звʼязуватись — інакше замовлення
          зависне в «думає».
        </div>
      ) : stepSeverity === "warning" ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span className="font-semibold">Час наступної дії минув.</span>{" "}
          Оновіть дату або зафіксуйте результат контакту.
        </div>
      ) : null}

      <div
        id="deal-next-step-block"
        className="mt-3 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-2.5"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Наступний крок
        </p>
        <p className="mt-0.5 text-sm font-medium text-[var(--enver-text)]">
          {nextActionLabel ?? "—"}
        </p>
        {meta.nextStepKind ? (
          <span className="mt-1 inline-block rounded-full border border-slate-200 bg-[var(--enver-card)] px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {NEXT_STEP_KINDS.find((k) => k.value === meta.nextStepKind)
              ?.label ?? meta.nextStepKind}
          </span>
        ) : null}
        <p className="mt-1 text-xs text-slate-600">
          {meta.nextActionAt
            ? format(new Date(meta.nextActionAt), "d MMM yyyy, HH:mm", {
                locale: uk,
              })
            : "Дату не вказано — «Редагувати дані»"}
        </p>
        {systemNextHint && meta.nextStepLabel?.trim() ? (
          <p className="mt-1.5 border-t border-slate-200/80 pt-1.5 text-[11px] text-slate-500">
            Підказка CRM: {systemNextHint}
          </p>
        ) : null}
      </div>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {err ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {err}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px]">
              <span className="text-slate-500">Назва замовлення</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-slate-500">Статус CRM</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                {DEAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] sm:col-span-2">
              <span className="text-slate-500">Опис</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-slate-500">Сума</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-slate-500">Валюта</span>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="UAH"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-slate-500">Очікуване закриття</span>
              <input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-slate-500">Підстатус (для бейджа)</span>
              <input
                value={subStatusLabel}
                onChange={(e) => setSubStatusLabel(e.target.value)}
                placeholder="Напр. Очікує КП"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-slate-500">Стан здоров’я замовлення</span>
              <select
                value={healthSel}
                onChange={(e) =>
                  setHealthSel(
                    e.target.value as NonNullable<DealWorkspaceMeta["health"]>,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                <option value="ok">Ок</option>
                <option value="at_risk">Ризик</option>
                <option value="blocked">Блокер</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <span className="text-[11px] text-slate-500">
                Швидкі пресети наступного кроку
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {STEP_PRESETS.map((p) => (
                  <button
                    key={p.kind + p.label}
                    type="button"
                    onClick={() => {
                      setNextStepKind(p.kind);
                      setNextStepLabel(p.label);
                    }}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-[11px]">
              <span className="text-slate-500">Тип кроку</span>
              <select
                value={nextStepKind}
                onChange={(e) => {
                  const v = e.target.value;
                  setNextStepKind(
                    v === ""
                      ? ""
                      : (v as NonNullable<DealWorkspaceMeta["nextStepKind"]>),
                  );
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                <option value="">Не вказано</option>
                {NEXT_STEP_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] sm:col-span-2">
              <span className="text-slate-500">
                Наступний крок (що зробити з клієнтом)
              </span>
              <input
                value={nextStepLabel}
                onChange={(e) => setNextStepLabel(e.target.value)}
                placeholder="Напр. Передзвонити з ціною фасаду"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px] sm:col-span-2">
              <span className="text-slate-500">Коли (дата й час)</span>
              <input
                type="datetime-local"
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={() => void saveAll()}
            className={cn(
              "rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800",
              saving && "opacity-60",
            )}
          >
            {saving ? "Збереження…" : "Зберегти замовлення та бейджі"}
          </button>
        </div>
      ) : null}
    </header>
  );
}
