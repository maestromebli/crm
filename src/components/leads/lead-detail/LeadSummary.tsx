"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useEffect, useState } from "react";
import { postJson } from "../../../lib/api/patch-json";
import { useLeadMutationActions } from "../../../features/leads/use-lead-mutation-actions";
import type { LeadDetailRow } from "../../../features/leads/queries";
import { dateToNextStepDateString } from "../../../lib/leads/next-step-date";
import {
  leadResponseStatus,
  leadWarningLevel,
} from "../../../lib/leads/lead-row-meta";
import { normalizePhoneDigits } from "../../../lib/leads/phone-normalize";
import { cn } from "../../../lib/utils";
import { LeadActions } from "./LeadActions";

type LeadSummaryProps = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
  canConvertToDeal: boolean;
};

function telHref(phone: string | null | undefined): string | null {
  const d = normalizePhoneDigits(phone);
  if (d.length < 9) return null;
  return `tel:+${d}`;
}

export function LeadSummary({
  lead,
  canUpdateLead,
  canConvertToDeal,
}: LeadSummaryProps) {
  const router = useRouter();
  const leadActions = useLeadMutationActions(lead.id);
  const [nextStep, setNextStep] = useState(lead.nextStep ?? "");
  const [nextStepDate, setNextStepDate] = useState(() =>
    dateToNextStepDateString(lead.nextContactAt) ?? "",
  );
  const [err, setErr] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [quickStageId, setQuickStageId] = useState(lead.stageId);
  const patchBusy = leadActions.isPending;
  const archivedStage = lead.pipelineStages.find((s) => s.slug === "archived");
  const canArchiveLead =
    canUpdateLead &&
    archivedStage != null &&
    archivedStage.id !== lead.stageId;

  useEffect(() => {
    setQuickStageId(lead.stageId);
    setNextStep(lead.nextStep ?? "");
    setNextStepDate(dateToNextStepDateString(lead.nextContactAt) ?? "");
  }, [lead.stageId, lead.nextStep, lead.nextContactAt]);

  const saveMeta = async () => {
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
  };

  const saveQuickStage = async (nextId: string) => {
    if (!canUpdateLead || nextId === lead.stageId) return;
    setErr(null);
    try {
      await leadActions.updateStage(nextId);
      setQuickStageId(nextId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося змінити стадію");
      setQuickStageId(lead.stageId);
    }
  };

  const recordCall = async () => {
    if (!canUpdateLead) return;
    setErr(null);
    try {
      await leadActions.recordTouch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  };

  const convertToDeal = async () => {
    if (!canConvertToDeal) return;
    setConverting(true);
    setErr(null);
    try {
      const data = await postJson<{ error?: string; dealId?: string }>(
        `/api/leads/${lead.id}/convert-to-deal`,
        {},
      );
      if (!data.dealId) {
        throw new Error(data.error ?? "Не вдалося створити замовлення");
      }
      router.push(`/deals/${data.dealId}/workspace?fromLead=1`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setConverting(false);
    }
  };

  const moveToArchive = async () => {
    if (!canArchiveLead || !archivedStage) return;
    setErr(null);
    try {
      await leadActions.updateStage(archivedStage.id);
      setQuickStageId(archivedStage.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося архівувати лід");
      setQuickStageId(lead.stageId);
    }
  };

  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const tel = telHref(phone);

  const meta = lead as Parameters<typeof leadResponseStatus>[0];
  const rs = leadResponseStatus(meta);
  const { level, hints } = leadWarningLevel(meta, false);

  return (
    <section className="mb-4 space-y-4 rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Що робити зараз?
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--enver-text)]">
            {lead.nextStep?.trim()
              ? lead.nextStep.trim()
              : lead.nextContactAt
                ? `Звʼязатися до ${format(new Date(lead.nextContactAt), "d MMMM yyyy", { locale: uk })}`
                : rs.key === "OVERDUE_TOUCH"
                  ? "Позначте дотик або заплануйте наступний крок"
                  : "Додайте наступний крок або дату контакту"}
          </p>
          {hints.length ? (
            <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
              {hints.map((h) => (
                <li
                  key={h}
                  className={cn(
                    level === "critical" ? "text-rose-700" : "text-amber-800",
                  )}
                >
                  · {h}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <LeadActions
          lead={lead}
          tel={tel}
          canConvertToDeal={canConvertToDeal}
          canArchiveLead={canArchiveLead}
          archiving={patchBusy}
          converting={converting}
          onConvert={() => void convertToDeal()}
          onArchive={() => void moveToArchive()}
          onCallNavigate={() => void recordCall()}
        />
      </div>

      {err ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}

      <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl bg-slate-50/80 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Контакт
          </p>
          <p className="mt-1 font-medium text-[var(--enver-text)]">
            {lead.contact?.fullName ?? lead.contactName ?? "—"}
          </p>
          <p className="text-slate-600">{phone ?? "—"}</p>
        </div>
        <div className="rounded-xl bg-slate-50/80 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Джерело
          </p>
          <p className="mt-1 font-medium text-[var(--enver-text)]">{lead.source}</p>
        </div>
        <div className="rounded-xl bg-slate-50/80 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Відповідальний
          </p>
          <p className="mt-1 font-medium text-[var(--enver-text)]">
            {lead.owner.name ?? lead.owner.email}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50/80 px-3 py-2 sm:col-span-2 lg:col-span-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Статус
          </p>
          {canUpdateLead ? (
            <select
              value={quickStageId}
              disabled={patchBusy}
              onChange={(e) => void saveQuickStage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-sm outline-none focus:border-slate-400 disabled:opacity-50"
            >
              {lead.pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 font-medium text-[var(--enver-text)]">{lead.stage.name}</p>
          )}
          <p className="mt-1 text-[10px] text-slate-500">
            Відповідь: {rs.label}
          </p>
        </div>
      </div>

      {canUpdateLead ? (
        <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-medium text-slate-500">
              Наступний крок
            </span>
            <input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Напр. передзвонити з КП"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="block space-y-1" id="lead-next-contact">
            <span className="text-[10px] font-medium text-slate-500">
              Дата наступного контакту
            </span>
            <input
              type="date"
              value={nextStepDate}
              onChange={(e) => setNextStepDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={patchBusy}
              onClick={() => void saveMeta()}
              className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {patchBusy ? "Зберігаю…" : "Зберегти крок і дату"}
            </button>
          </div>
        </div>
      ) : null}

      {lead.note?.trim() ? (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Коментар
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {lead.note}
          </p>
          {canUpdateLead ? (
            <Link
              href={`/leads/${lead.id}`}
              className="mt-2 inline-block text-xs text-slate-600 underline"
            >
              Редагувати в блоці нижче
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
