"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { leadProposalStatusUa } from "../../../../lib/leads/lead-proposal-labels";
import { parseJsonResponse } from "../../../../lib/http/parse-json-response";
import { cn } from "../../../../lib/utils";

type QuoteState = "draft" | "sent" | "approved";

function mapStatus(raw: string): QuoteState {
  const s = raw.toUpperCase();
  if (s.includes("SENT") || s.includes("НАДІСЛАН")) return "sent";
  if (s.includes("APPROV") || s.includes("ПОГОД")) return "approved";
  return "draft";
}

type Props = {
  lead: LeadDetailRow;
  canManageEstimates: boolean;
};

export function LeadHubQuoteSection({ lead, canManageEstimates }: Props) {
  const router = useRouter();
  const latest = lead.proposals[0];
  const [pdfBusy, setPdfBusy] = useState(false);

  const generatePdf = async () => {
    if (!latest || !canManageEstimates) return;
    setPdfBusy(true);
    try {
      const r = await fetch(
        `/api/leads/${lead.id}/proposals/${latest.id}/pdf`,
        { method: "POST" },
      );
      const j = await parseJsonResponse<{ error?: string }>(r);
      if (!r.ok) throw new Error(j.error ?? "Не вдалося згенерувати PDF");
      router.refresh();
    } catch {
      /* surface via UI — keep minimal */
    } finally {
      setPdfBusy(false);
    }
  };

  const state = latest ? mapStatus(latest.status) : "draft";

  return (
    <section
      id="lead-quote"
      className="enver-card-appear rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-medium text-[var(--enver-text)]">
            Комерційна пропозиція (КП)
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--enver-muted)]">
            Стан узгодження та PDF для клієнта.
          </p>
        </div>
        <Link
          href={`/leads/${lead.id}/pricing`}
          className="text-[12px] font-medium text-[var(--enver-accent)] transition hover:underline"
        >
          Редагувати КП →
        </Link>
      </div>

      {!latest ? (
        <p className="mt-4 text-[14px] text-[var(--enver-muted)]">
          КП ще не створено — почніть із розрахунку та знімка смети.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-medium text-[var(--enver-text)]">
              КП v{latest.version}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                state === "draft" && "bg-[var(--enver-surface)] text-[var(--enver-text-muted)]",
                state === "sent" && "bg-[var(--enver-accent-soft)] text-[var(--enver-accent-hover)]",
                state === "approved" && "bg-[#ECFDF5] text-[#047857]",
              )}
            >
              {state === "draft" && "Чернетка"}
              {state === "sent" && "Надіслано"}
              {state === "approved" && "Погоджено"}
            </span>
            <span className="text-[12px] text-[var(--enver-muted)]">
              ({leadProposalStatusUa(latest.status)})
            </span>
          </div>
          <p className="text-[12px] text-[var(--enver-muted)]">
            Створено:{" "}
            {format(new Date(latest.createdAt), "d MMM yyyy, HH:mm", {
              locale: uk,
            })}
            {latest.sentAt
              ? ` · надіслано: ${format(new Date(latest.sentAt), "d MMM HH:mm", { locale: uk })}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {canManageEstimates ? (
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() => void generatePdf()}
                className="enver-press rounded-[12px] bg-[#2563EB] px-4 py-2.5 text-[14px] font-semibold text-white transition duration-200 hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {pdfBusy ? "Генерація…" : "Згенерувати PDF КП"}
              </button>
            ) : null}
            {latest.hasPdf && latest.pdfFileUrl ? (
              <a
                href={latest.pdfFileUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-2.5 text-[14px] font-medium text-[var(--enver-text)] transition duration-200 hover:border-[var(--enver-border-strong)]"
              >
                Відкрити PDF
              </a>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
