"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { deleteJson, postJson } from "../../lib/api/patch-json";
import { useLeadMutationActions } from "../../features/leads/use-lead-mutation-actions";
import type { LeadDetailRow } from "../../features/leads/queries";
import { LeadAiManagerPanel } from "./LeadAiManagerPanel";

type Props = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
  canDeleteLead: boolean;
  canConvertToDeal: boolean;
};

const REFERRAL_TYPE_LABEL: Record<
  "DESIGNER" | "CONSTRUCTION_COMPANY" | "PERSON",
  string
> = {
  DESIGNER: "Дизайнер",
  CONSTRUCTION_COMPANY: "Будівельна компанія",
  PERSON: "Людина",
};

export function LeadDetailOverviewClient({
  lead,
  canUpdateLead,
  canDeleteLead,
  canConvertToDeal,
}: Props) {
  const router = useRouter();
  const leadActions = useLeadMutationActions(lead.id);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState(lead.title);
  const [source, setSource] = useState(lead.source);
  const [priority, setPriority] = useState(lead.priority);
  const [stageId, setStageId] = useState(lead.stageId);
  const [contactName, setContactName] = useState(
    lead.contactName ?? lead.contact?.fullName ?? "",
  );
  const [phone, setPhone] = useState(
    lead.phone ?? lead.contact?.phone ?? "",
  );
  const [email, setEmail] = useState(
    lead.email ?? lead.contact?.email ?? "",
  );
  const [note, setNote] = useState(lead.note ?? "");
  const [referralType, setReferralType] = useState<
    "DESIGNER" | "CONSTRUCTION_COMPANY" | "PERSON"
  >(lead.referral?.type ?? "PERSON");
  const [referralName, setReferralName] = useState(lead.referral?.name ?? "");
  const [referralPhone, setReferralPhone] = useState(lead.referral?.phone ?? "");
  const [referralEmail, setReferralEmail] = useState(lead.referral?.email ?? "");
  const [dealTitleDraft, setDealTitleDraft] = useState(lead.title);
  const [quickStageId, setQuickStageId] = useState(lead.stageId);
  const patchBusy = leadActions.isPending;

  useEffect(() => {
    setQuickStageId(lead.stageId);
  }, [lead.stageId]);

  const resetForm = useCallback(() => {
    setTitle(lead.title);
    setSource(lead.source);
    setPriority(lead.priority);
    setStageId(lead.stageId);
    setContactName(lead.contactName ?? lead.contact?.fullName ?? "");
    setPhone(lead.phone ?? lead.contact?.phone ?? "");
    setEmail(lead.email ?? lead.contact?.email ?? "");
    setNote(lead.note ?? "");
    setReferralType(lead.referral?.type ?? "PERSON");
    setReferralName(lead.referral?.name ?? "");
    setReferralPhone(lead.referral?.phone ?? "");
    setReferralEmail(lead.referral?.email ?? "");
    setDealTitleDraft(lead.title);
    setErr(null);
  }, [lead]);

  const save = async () => {
    setErr(null);
    try {
      await leadActions.patch({
        title,
        source,
        priority,
        stageId,
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        note: note.trim() || null,
        referralType,
        referralName: referralName.trim() || null,
        referralPhone: referralPhone.trim() || null,
        referralEmail: referralEmail.trim() || null,
      });
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка збереження");
    }
  };

  const saveQuickStage = async (nextId: string) => {
    if (nextId === lead.stageId) return;
    setErr(null);
    try {
      await leadActions.updateStage(nextId);
      setQuickStageId(nextId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося змінити стадію");
      setQuickStageId(lead.stageId);
    }
  };

  const convertToDeal = async () => {
    setConverting(true);
    setErr(null);
    try {
      const data = await postJson<{
        error?: string;
        dealId?: string;
        alreadyLinked?: boolean;
        filesMigrated?: number;
      }>(`/api/leads/${lead.id}/convert-to-deal`, {
        ...(dealTitleDraft.trim() ? { dealTitle: dealTitleDraft.trim() } : {}),
      });
      if (!data.dealId) {
        setErr(data.error ?? "Не вдалося створити угоду");
        return;
      }
      router.push(`/deals/${data.dealId}/workspace?fromLead=1`);
      router.refresh();
    } finally {
      setConverting(false);
    }
  };

  const deleteLead = async () => {
    if (!canDeleteLead || deleting) return;
    const confirmed = window.confirm(
      "Видалити цей лід? Дію неможливо скасувати.",
    );
    if (!confirmed) return;
    setDeleting(true);
    setErr(null);
    try {
      await deleteJson<{ ok?: boolean; error?: string }>(`/api/leads/${lead.id}`);
      router.push("/leads");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося видалити лід");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <LeadAiManagerPanel
          lead={lead}
          canUpdateLead={canUpdateLead}
          compact
        />
      </div>

      <section
        id="lead-convert"
        className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm md:col-span-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Угода з ліда
          </h2>
          {lead.linkedDeal ? (
            <Link
              href={`/deals/${lead.linkedDeal.id}/workspace`}
              className="text-xs font-medium text-[var(--enver-text)] underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600"
            >
              Відкрити «{lead.linkedDeal.title}» ·{" "}
              {lead.linkedDeal.stage.name} →
            </Link>
          ) : canConvertToDeal ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={dealTitleDraft}
                onChange={(e) => setDealTitleDraft(e.target.value)}
                placeholder="Назва угоди"
                className="min-w-[12rem] rounded-lg border border-slate-200 px-2 py-1 text-xs text-[var(--enver-text)] outline-none focus:border-slate-400"
              />
              <button
                type="button"
                disabled={converting}
                onClick={convertToDeal}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {converting ? "Створення…" : "Створити угоду"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Потрібні права на оновлення ліда та створення угод.
            </p>
          )}
        </div>
        {!lead.linkedDeal && canConvertToDeal ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Дані ліда оновлять картку контакту; файли та прорахунки з хаба ліда
            переносяться в угоду. Лід переводиться в архів (воронка лідів).
            Відповідальний за угоду — як у ліда.
          </p>
        ) : null}
      </section>

      {err ? (
        <p
          className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          role="alert"
        >
          {err}
        </p>
      ) : null}

      <section
        id="lead-details"
        className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm md:col-span-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Лід — повні поля
          </h2>
          {canUpdateLead || canDeleteLead ? (
            editing ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={patchBusy}
                  onClick={() => {
                    resetForm();
                    setEditing(false);
                  }}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-[var(--enver-hover)]"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  disabled={patchBusy}
                  onClick={save}
                  className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {patchBusy ? "Збереження…" : "Зберегти"}
                </button>
                {canDeleteLead ? (
                  <button
                    type="button"
                    disabled={deleting || patchBusy}
                    onClick={() => void deleteLead()}
                    className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {deleting ? "Видалення…" : "Видалити лід"}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex gap-2">
                {canUpdateLead ? (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-[var(--enver-hover)]"
                  >
                    Редагувати
                  </button>
                ) : null}
                {canDeleteLead ? (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void deleteLead()}
                    className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {deleting ? "Видалення…" : "Видалити лід"}
                  </button>
                ) : null}
              </div>
            )
          ) : null}
        </div>

        {editing ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-[10px] text-slate-400">Назва</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[10px] text-slate-400">Джерело</span>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[10px] text-slate-400">Пріоритет</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
              >
                <option value="low">низький</option>
                <option value="normal">звичайний</option>
                <option value="high">високий</option>
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-[10px] text-slate-400">Стадія</span>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
              >
                {lead.pipelineStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isFinal ? " (фінал)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-[10px] text-slate-400">Контакт · імʼя</span>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[10px] text-slate-400">Телефон</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="text-[10px] text-slate-400">Е-пошта</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="text-[10px] text-slate-400">Нотатка</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-0.5 w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
              />
            </label>
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Хто привів замовника
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="text-[10px] text-slate-400">Тип</span>
                  <select
                    value={referralType}
                    onChange={(e) =>
                      setReferralType(
                        e.target.value as
                          | "DESIGNER"
                          | "CONSTRUCTION_COMPANY"
                          | "PERSON",
                      )
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
                  >
                    <option value="DESIGNER">Дизайнер</option>
                    <option value="CONSTRUCTION_COMPANY">
                      Будівельна компанія
                    </option>
                    <option value="PERSON">Людина</option>
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="text-[10px] text-slate-400">Імʼя / назва</span>
                  <input
                    value={referralName}
                    onChange={(e) => setReferralName(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-[10px] text-slate-400">Телефон</span>
                  <input
                    value={referralPhone}
                    onChange={(e) => setReferralPhone(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-[10px] text-slate-400">Е-пошта</span>
                  <input
                    value={referralEmail}
                    onChange={(e) => setReferralEmail(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400"
                  />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[10px] text-slate-400">Назва</dt>
              <dd className="text-[var(--enver-text)]">{lead.title}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400">Джерело</dt>
              <dd className="text-[var(--enver-text)]">{lead.source}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400">Пріоритет</dt>
              <dd className="text-[var(--enver-text)]">{lead.priority}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400">Контакт</dt>
              <dd className="text-[var(--enver-text)]">
                {lead.contact?.fullName ?? lead.contactName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400">Телефон</dt>
              <dd className="text-[var(--enver-text)]">
                {lead.contact?.phone ?? lead.phone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400">Е-пошта</dt>
              <dd className="text-[var(--enver-text)]">
                {lead.contact?.email ?? lead.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400">Відповідальний</dt>
              <dd className="text-[var(--enver-text)]">
                {lead.owner.name ?? lead.owner.email}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400">Хто привів</dt>
              <dd className="text-[var(--enver-text)]">
                {lead.referral?.name?.trim()
                  ? `${REFERRAL_TYPE_LABEL[lead.referral.type]} · ${lead.referral.name}`
                  : "—"}
              </dd>
              {(lead.referral?.phone || lead.referral?.email) ? (
                <p className="text-xs text-slate-500">
                  {[lead.referral.phone, lead.referral.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] text-slate-400">Стадія</dt>
              <dd className="text-[var(--enver-text)]">
                {canUpdateLead && !editing ? (
                  <div className="mt-1 flex max-w-md flex-col gap-1">
                    <select
                      value={quickStageId}
                      disabled={patchBusy}
                      onChange={(e) => {
                        const v = e.target.value;
                        setQuickStageId(v);
                        void saveQuickStage(v);
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-[var(--enver-text)] outline-none focus:border-slate-400 disabled:opacity-50"
                    >
                      {lead.pipelineStages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.isFinal ? " (фінал)" : ""}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500">
                      Швидка зміна стадії менеджером (без режиму «Редагувати»).
                    </span>
                  </div>
                ) : (
                  lead.stage.name
                )}
              </dd>
            </div>
            {lead.note ? (
              <div className="sm:col-span-2">
                <dt className="text-[10px] text-slate-400">Нотатка</dt>
                <dd className="whitespace-pre-wrap text-slate-700">
                  {lead.note}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>

    </div>
  );
}
