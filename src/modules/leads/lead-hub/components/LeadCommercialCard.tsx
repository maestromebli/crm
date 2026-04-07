"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import Link from "next/link";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { deriveCommercialMicroHints } from "../../../../lib/leads/estimate-sales-heuristics";
import { leadProposalStatusUa } from "../../../../lib/leads/lead-proposal-labels";

type Props = {
  lead: LeadDetailRow;
  canCreateLeadEstimate: boolean;
  estBusy: boolean;
  proposalBusy?: boolean;
  pdfBusy?: boolean;
  onCreateEstimate: (templateKey: string | null, clone: boolean) => void;
  onProposalNote: () => void;
  onCreateProposalFromEstimate?: () => void;
  onGenerateProposalPdf?: () => void;
  onCopyProposalLink?: () => void;
  onMarkProposalSent?: () => void;
};

export function LeadCommercialCard({
  lead,
  canCreateLeadEstimate,
  estBusy,
  proposalBusy = false,
  pdfBusy = false,
  onCreateEstimate,
  onProposalNote,
  onCreateProposalFromEstimate,
  onGenerateProposalPdf,
  onCopyProposalLink,
  onMarkProposalSent,
}: Props) {
  const latest = lead.estimates[0];
  const latestProposal = lead.proposals[0];
  const microHints = deriveCommercialMicroHints(lead);

  return (
    <section
      id="lead-hub-commercial"
      className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/40 to-white p-4 shadow-sm"
    >
      <h3 className="text-xs font-semibold text-[var(--enver-text)]">Комерція</h3>
      <p className="mt-0.5 text-[11px] text-slate-600">
        Смета й КП змінюються разом із діалогом — версії зберігають історію, фінал
        після узгодження та угоди.
      </p>
      {microHints.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-emerald-100/80 pt-2 text-[10px] leading-snug text-emerald-950/90">
          {microHints.map((h, i) => (
            <li key={i}>· {h}</li>
          ))}
        </ul>
      ) : null}

      {!latest ? (
        <div className="mt-3 rounded-xl border border-dashed border-emerald-300 bg-[var(--enver-card)]/80 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-800">
            Немає прорахунку
          </p>
          {canCreateLeadEstimate ? (
            <button
              type="button"
              disabled={estBusy}
              onClick={() => onCreateEstimate(null, false)}
              className="mt-3 w-full max-w-xs rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {estBusy ? "Створення…" : "Створити прорахунок"}
            </button>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Немає права на прорахунок</p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-100 bg-[var(--enver-card)] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--enver-text)]">
              Версія {latest.version}
              {latest.templateKey ? ` · ${latest.templateKey}` : ""}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
              {latest.status}
            </span>
          </div>
          <p className="text-lg font-bold text-[var(--enver-text)]">
            {latest.totalPrice != null
              ? `${latest.totalPrice.toLocaleString("uk-UA")} грн`
              : "— грн"}
          </p>
          <p className="text-[11px] text-slate-500">
            Оновлено:{" "}
            {format(new Date(latest.updatedAt), "d MMM yyyy, HH:mm", {
              locale: uk,
            })}
          </p>
          {canCreateLeadEstimate ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
              <Link
                href={`/leads/${lead.id}/estimate/${latest.id}`}
                className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800"
              >
                Відкрити прорахунок
              </Link>
              <button
                type="button"
                disabled={estBusy}
                onClick={() => onCreateEstimate(null, true)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium hover:bg-[var(--enver-hover)] disabled:opacity-50"
                title="Нова версія на базі поточної"
              >
                Нова версія
              </button>
              {onCreateProposalFromEstimate ? (
                <button
                  type="button"
                  disabled={proposalBusy || estBusy}
                  onClick={() => onCreateProposalFromEstimate()}
                  className="rounded-lg border border-emerald-600 bg-emerald-600/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-900 hover:bg-emerald-600/15 disabled:opacity-50"
                >
                  {proposalBusy ? "КП…" : "Створити КП"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onProposalNote()}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-[var(--enver-hover)]"
              >
                Лог: КП надіслано
              </button>
            </div>
          ) : null}
          {canCreateLeadEstimate ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={estBusy}
                onClick={() => onCreateEstimate("kitchen", false)}
                className="rounded-lg border border-dashed border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-[var(--enver-hover)] disabled:opacity-50"
              >
                + Шаблон: кухня
              </button>
            </div>
          ) : null}

          {latestProposal ? (
            <div className="mt-3 rounded-xl border border-sky-200/80 bg-sky-50/90 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                Комерційна пропозиція (КП)
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--enver-text)]">
                  Версія КП {latestProposal.version}
                </span>
                <span className="rounded-full bg-[var(--enver-card)]/90 px-2 py-0.5 text-[10px] font-medium text-sky-950 ring-1 ring-sky-200">
                  {leadProposalStatusUa(latestProposal.status)}
                </span>
              </div>
              {latestProposal.estimateVersion != null ? (
                <p className="mt-1 text-[11px] text-slate-600">
                  Звʼязок зі сметою: v{latestProposal.estimateVersion}
                </p>
              ) : null}
              <p className="mt-1 text-[10px] text-slate-500">
                Створено:{" "}
                {format(new Date(latestProposal.createdAt), "d MMM yyyy, HH:mm", {
                  locale: uk,
                })}
                {latestProposal.sentAt
                  ? ` · надіслано: ${format(new Date(latestProposal.sentAt), "d MMM HH:mm", { locale: uk })}`
                  : ""}
                {latestProposal.viewedAt
                  ? ` · перегляд: ${format(new Date(latestProposal.viewedAt), "d MMM HH:mm", { locale: uk })}`
                  : ""}
              </p>
              {canCreateLeadEstimate &&
              (onGenerateProposalPdf ||
                onCopyProposalLink ||
                onMarkProposalSent) ? (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-sky-100/80 pt-2">
                  {onGenerateProposalPdf ? (
                    <button
                      type="button"
                      disabled={pdfBusy || proposalBusy}
                      onClick={() => onGenerateProposalPdf()}
                      className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {pdfBusy ? "PDF…" : "PDF КП"}
                    </button>
                  ) : null}
                  {latestProposal.hasPdf ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span className="rounded-lg border border-sky-200 px-2 py-1 text-[10px] text-sky-900">
                        PDF збережено
                      </span>
                      {latestProposal.pdfFileUrl ? (
                        <a
                          href={latestProposal.pdfFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-emerald-300 bg-[var(--enver-card)] px-2 py-1 text-[10px] font-medium text-emerald-900 hover:bg-emerald-50"
                        >
                          Відкрити PDF
                        </a>
                      ) : null}
                    </span>
                  ) : null}
                  {onCopyProposalLink && latestProposal.publicToken ? (
                    <button
                      type="button"
                      onClick={() => onCopyProposalLink()}
                      className="rounded-lg border border-sky-300 px-2 py-1 text-[10px] font-medium text-sky-950 hover:bg-[var(--enver-card)]"
                    >
                      Копіювати посилання
                    </button>
                  ) : null}
                  {latestProposal.publicToken ? (
                    <Link
                      href={`/p/${latestProposal.publicToken}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-700 hover:bg-[var(--enver-card)]"
                    >
                      Відкрити публічно
                    </Link>
                  ) : null}
                  {onMarkProposalSent ? (
                    <button
                      type="button"
                      disabled={proposalBusy}
                      onClick={() => onMarkProposalSent()}
                      className="rounded-lg border border-emerald-600 px-2 py-1 text-[10px] font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      КП надіслано
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
