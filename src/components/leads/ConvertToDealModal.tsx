"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { LeadDetailRow } from "../../features/leads/queries";
import type { LeadHubSummaryApiResponse } from "../../lib/leads/hub-summary-api";
import {
  computeLeadReadinessRows,
  deriveConvertReadinessBanner,
  type LeadReadinessRow,
} from "../../lib/leads/lead-readiness-rows";
import {
  DEFAULT_CONVERT_LEAD_TRANSFER,
  type ConvertLeadToDealInput,
} from "../../lib/leads/convert-lead-to-deal.shared";
import { cn } from "../../lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  lead: LeadDetailRow;
  canConvert: boolean;
  onConverted: (dealId: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

function ModalReadinessRow({ row }: { row: LeadReadinessRow }) {
  const tone =
    row.state === "ready"
      ? "text-emerald-800"
      : row.state === "partial"
        ? "text-amber-950"
        : "text-rose-900";
  const badge =
    row.state === "ready"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : row.state === "partial"
        ? "bg-amber-50 text-amber-950 ring-amber-200"
        : "bg-rose-50 text-rose-900 ring-rose-200";
  const b =
    row.state === "ready" ? "OK" : row.state === "partial" ? "Частково" : "Ні";

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-[var(--enver-card)]/90 px-2 py-1.5">
      <div className="min-w-0">
        <p className={cn("text-[11px] font-medium", tone)}>{row.label}</p>
        {row.hint ? (
          <p className="text-[10px] text-slate-500">{row.hint}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1",
          badge,
        )}
      >
        {b}
      </span>
    </div>
  );
}

export function ConvertToDealModal({
  open,
  onClose,
  lead,
  canConvert,
  onConverted,
  onBusyChange,
}: Props) {
  const [dealTitle, setDealTitle] = useState(lead.title);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [files, setFiles] = useState(DEFAULT_CONVERT_LEAD_TRANSFER.files);
  const [currentEstimate, setCurrentEstimate] = useState(
    DEFAULT_CONVERT_LEAD_TRANSFER.commercial.currentEstimate,
  );
  const [lastProposal, setLastProposal] = useState(
    DEFAULT_CONVERT_LEAD_TRANSFER.commercial.lastProposal,
  );
  const [drafts, setDrafts] = useState(
    DEFAULT_CONVERT_LEAD_TRANSFER.commercial.drafts,
  );
  const [commMode, setCommMode] = useState<"full" | "recent">("full");
  const [recentCount, setRecentCount] = useState(30);

  const [ownerId, setOwnerId] = useState(lead.ownerId);
  const [productionManagerId, setProductionManagerId] = useState("");
  const [installationDate, setInstallationDate] = useState("");
  const [handoffNote, setHandoffNote] = useState("");

  const [assignees, setAssignees] = useState<
    { id: string; name: string | null; email: string }[]
  >([]);

  const [hubSummary, setHubSummary] = useState<LeadHubSummaryApiResponse | null>(
    null,
  );
  const [hubLoading, setHubLoading] = useState(false);
  const [hubFetchErr, setHubFetchErr] = useState(false);

  const contactRows = useMemo(() => {
    const rows: Array<{
      id: string;
      label: string;
      isPrimary: boolean;
    }> = [];
    const seen = new Set<string>();
    if (lead.contactId && lead.contact) {
      seen.add(lead.contactId);
      rows.push({
        id: lead.contactId,
        label: `${lead.contact.fullName} (основний)`,
        isPrimary: true,
      });
    }
    for (const lc of lead.leadContacts) {
      if (seen.has(lc.contactId)) continue;
      seen.add(lc.contactId);
      rows.push({
        id: lc.contactId,
        label: lc.fullName + (lc.role ? ` — ${lc.role}` : ""),
        isPrimary: false,
      });
    }
    return rows;
  }, [lead.contact, lead.contactId, lead.leadContacts]);

  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    () => new Set(contactRows.map((r) => r.id)),
  );

  useEffect(() => {
    if (!open) return;
    setDealTitle(lead.title);
    setErr(null);
    setFiles(DEFAULT_CONVERT_LEAD_TRANSFER.files);
    setCurrentEstimate(DEFAULT_CONVERT_LEAD_TRANSFER.commercial.currentEstimate);
    setLastProposal(DEFAULT_CONVERT_LEAD_TRANSFER.commercial.lastProposal);
    setDrafts(DEFAULT_CONVERT_LEAD_TRANSFER.commercial.drafts);
    setCommMode("full");
    setRecentCount(30);
    setOwnerId(lead.ownerId);
    setProductionManagerId("");
    setInstallationDate("");
    setHandoffNote("");
    const ids = new Set<string>();
    if (lead.contactId) ids.add(lead.contactId);
    for (const lc of lead.leadContacts) ids.add(lc.contactId);
    setSelectedContacts(ids);
  }, [open, lead.id, lead.updatedAt, lead.title, lead.ownerId, lead.contactId, lead.leadContacts]);

  useEffect(() => {
    if (!open || !canConvert) return;
    let c = false;
    void (async () => {
      try {
        const r = await fetch("/api/leads/assignees");
        const j = (await r.json()) as {
          assignees?: { id: string; name: string | null; email: string }[];
        };
        if (!c && r.ok) setAssignees(j.assignees ?? []);
      } catch {
        /* noop */
      }
    })();
    return () => {
      c = true;
    };
  }, [open, canConvert]);

  useLayoutEffect(() => {
    if (open && canConvert) {
      setHubLoading(true);
      setHubFetchErr(false);
    }
  }, [open, canConvert]);

  useEffect(() => {
    if (!open || !canConvert) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/leads/${lead.id}/hub-summary`);
        const j = (await r.json()) as LeadHubSummaryApiResponse & {
          error?: string;
        };
        if (!r.ok) throw new Error(j.error ?? "hub-summary");
        if (!cancelled) setHubSummary(j);
      } catch {
        if (!cancelled) {
          setHubFetchErr(true);
          setHubSummary(null);
        }
      } finally {
        if (!cancelled) setHubLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, canConvert, lead.id, lead.updatedAt]);

  const fallbackRows = useMemo(() => computeLeadReadinessRows(lead), [lead]);
  const fallbackBanner = useMemo(
    () => deriveConvertReadinessBanner(lead),
    [lead],
  );

  const readinessRows = hubSummary?.readinessRows ?? fallbackRows;
  const convertBanner = hubSummary?.convertBanner ?? fallbackBanner;

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = useCallback(async () => {
    if (!canConvert) return;
    if (contactRows.length > 0 && selectedContacts.size === 0) {
      setErr("Оберіть хоча б один контакт для угоди.");
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setErr(null);
    const input: ConvertLeadToDealInput = {
      dealTitle: dealTitle.trim() || undefined,
      transfer: {
        files,
        commercial: {
          currentEstimate,
          lastProposal,
          drafts,
        },
        contactIds:
          selectedContacts.size === contactRows.length
            ? null
            : Array.from(selectedContacts),
        communication:
          commMode === "full"
            ? { mode: "full" }
            : { mode: "recent", recentCount },
      },
      dealSetup: {
        ownerId,
        productionManagerId: productionManagerId.trim() || null,
        installationDate: installationDate.trim() || null,
        handoffNote: handoffNote.trim() || null,
      },
    };
    try {
      const r = await fetch(`/api/leads/${lead.id}/convert-to-deal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await r.json()) as {
        error?: string;
        dealId?: string;
        alreadyLinked?: boolean;
      };
      if (!r.ok || !data.dealId) {
        throw new Error(data.error ?? "Не вдалося створити угоду");
      }
      onConverted(data.dealId);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }, [
    canConvert,
    contactRows.length,
    commMode,
    currentEstimate,
    dealTitle,
    drafts,
    files,
    handoffNote,
    installationDate,
    lastProposal,
    lead.id,
    onBusyChange,
    onClose,
    onConverted,
    ownerId,
    productionManagerId,
    recentCount,
    selectedContacts,
  ]);

  if (!open || !canConvert || lead.linkedDeal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-deal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--enver-card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="convert-deal-title"
          className="text-sm font-semibold text-[var(--enver-text)]"
        >
          Лід → угода
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Перевірте готовність, оберіть перенос і мінімальні поля для виконання.
        </p>

        {hubFetchErr ? (
          <p className="mt-2 text-[10px] text-amber-800">
            Не вдалося зчитати готовність з сервера — показано локальний розрахунок
            (як у картці ліда).
          </p>
        ) : null}

        <div
          className={cn(
            "mt-3 rounded-xl border px-3 py-2 text-xs",
            hubLoading && !hubSummary && "animate-pulse border-slate-200 bg-slate-100",
            (!hubLoading || hubSummary) &&
              convertBanner.variant === "ready" &&
              "border-emerald-200 bg-emerald-50/90 text-emerald-950",
            (!hubLoading || hubSummary) &&
              convertBanner.variant === "warn" &&
              "border-amber-200 bg-amber-50/90 text-amber-950",
            (!hubLoading || hubSummary) &&
              convertBanner.variant === "attention" &&
              "border-rose-200 bg-rose-50/90 text-rose-950",
          )}
        >
          {hubLoading && !hubSummary ? (
            <>
              <div className="h-3 w-full max-w-[85%] rounded bg-slate-200" />
              <div className="mt-2 h-3 w-full rounded bg-slate-200" />
            </>
          ) : (
            <>
              <p className="font-semibold">{convertBanner.title}</p>
              <p className="mt-0.5 leading-snug opacity-90">
                {convertBanner.subtitle}
              </p>
            </>
          )}
        </div>

        <section className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-[10px] font-semibold uppercase text-slate-500">
              Готовність
            </p>
            {hubSummary ? (
              <p className="text-[9px] text-slate-400">
                API ·{" "}
                {new Date(hubSummary.updatedAt).toLocaleString("uk-UA", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            ) : hubLoading ? (
              <p className="text-[9px] text-slate-400">Завантаження…</p>
            ) : (
              <p className="text-[9px] text-slate-400">локально</p>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {hubLoading && !hubSummary
              ? [1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg bg-slate-200/80"
                  />
                ))
              : readinessRows.map((row) => (
                  <ModalReadinessRow key={row.key} row={row} />
                ))}
          </div>
        </section>

        <section className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Файли
          </p>
          {(
            [
              ["measurements", "Заміри / розрахунки"],
              ["renders", "Візуалізації / фото об’єкта"],
              ["proposalPdf", "КП (PDF)"],
              ["others", "Інші"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"
            >
              <input
                type="checkbox"
                checked={files[key]}
                onChange={(e) =>
                  setFiles((f) => ({ ...f, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </section>

        <section className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Комерція
          </p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={currentEstimate}
              onChange={(e) => setCurrentEstimate(e.target.checked)}
            />
            Поточні прорахунки на угоду
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={lastProposal}
              onChange={(e) => setLastProposal(e.target.checked)}
            />
            Останнє КП (PDF у файлах)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={drafts}
              onChange={(e) => setDrafts(e.target.checked)}
            />
            Чернетки смет
          </label>
        </section>

        <section className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Контакти
          </p>
          {contactRows.length === 0 ? (
            <p className="text-xs text-slate-500">Немає додаткових контактів.</p>
          ) : (
            contactRows.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-2 text-xs"
              >
                <input
                  type="checkbox"
                  checked={selectedContacts.has(r.id)}
                  onChange={() => toggleContact(r.id)}
                />
                {r.label}
              </label>
            ))
          )}
        </section>

        <section className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Комунікація
          </p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name="comm"
              checked={commMode === "full"}
              onChange={() => setCommMode("full")}
            />
            Повна історія (зв’язок з лідом, без дублювання)
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="comm"
                checked={commMode === "recent"}
                onChange={() => setCommMode("recent")}
              />
              Останні
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={recentCount}
              onChange={(e) => setRecentCount(Number(e.target.value) || 30)}
              disabled={commMode !== "recent"}
              className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs"
            />
            <span className="text-slate-500">записів у підказках</span>
          </div>
        </section>

        <section className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Угода
          </p>
          <label className="block text-xs">
            <span className="text-slate-500">Назва</span>
            <input
              value={dealTitle}
              onChange={(e) => setDealTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-500">Менеджер (відповідальний)</span>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              {assignees.some((a) => a.id === lead.ownerId) ? null : (
                <option value={lead.ownerId}>
                  {lead.owner.name ?? lead.owner.email} (поточний)
                </option>
              )}
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email}
                  {a.id === lead.ownerId ? " (поточний)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-500">Менеджер виробництва</span>
            <select
              value={productionManagerId}
              onChange={(e) => setProductionManagerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-slate-500">Дата монтажу (опційно)</span>
            <input
              type="date"
              value={installationDate}
              onChange={(e) => setInstallationDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-500">
              Примітка для виробництва / виконання (опційно)
            </span>
            <textarea
              value={handoffNote}
              onChange={(e) => setHandoffNote(e.target.value)}
              rows={3}
              placeholder="Короткий контекст для команди після передачі з продажу…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
        </section>

        {err ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            {err}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          >
            Скасувати
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "Створення…" : "Створити угоду"}
          </button>
        </div>
      </div>
    </div>
  );
}
