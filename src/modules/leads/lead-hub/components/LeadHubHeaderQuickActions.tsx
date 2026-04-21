"use client";

import { Calendar, FileUp, MessageSquareText, Phone, StickyNote } from "lucide-react";
import Link from "next/link";
import { cn } from "../../../../lib/utils";

type Props = {
  leadId: string;
  phone: string | null;
  mode?: "new" | "contacted" | "proposal" | "closing" | "stuck";
  canConvertToDeal?: boolean;
  convertingToDeal?: boolean;
  canUploadLeadFiles: boolean;
  canDeleteLead?: boolean;
  deletingLead?: boolean;
  canArchiveLead?: boolean;
  archiving?: boolean;
  onUploadClick: () => void;
  onScheduleMeasure: () => void;
  onFocusNotesTab: () => void;
  onConvertToDeal?: () => void;
  onDeleteLead?: () => void;
  onArchiveLead?: () => void;
  className?: string;
};

const baseBtn =
  "leadhub-btn enver-press inline-flex h-9 min-w-[116px] items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[11px] font-medium transition duration-200";

export function LeadHubHeaderQuickActions({
  leadId,
  phone,
  mode = "contacted",
  canConvertToDeal = false,
  convertingToDeal = false,
  canUploadLeadFiles,
  canDeleteLead = false,
  deletingLead = false,
  canArchiveLead = false,
  archiving = false,
  onUploadClick,
  onScheduleMeasure,
  onFocusNotesTab,
  onConvertToDeal,
  onDeleteLead,
  onArchiveLead,
  className,
}: Props) {
  const tel = phone?.replace(/\s+/g, "");
  const canConvertAction = canConvertToDeal && typeof onConvertToDeal === "function";
  const canArchiveAction = canArchiveLead && typeof onArchiveLead === "function";
  const canDeleteAction = canDeleteLead && typeof onDeleteLead === "function";
  const showCall = mode === "new" || mode === "contacted" || mode === "stuck";
  const showMeasure = mode === "new" || mode === "contacted";
  const showConvert = mode === "closing";
  const showMessages = mode !== "closing";

  return (
    <details className={cn("leadhub-card-soft", className)}>
      <summary
        className="cursor-pointer list-none px-2.5 py-2 text-right text-[11px] font-medium text-[var(--enver-muted)] transition duration-200 hover:text-[var(--enver-text)] marker:hidden [&::-webkit-details-marker]:hidden"
        aria-label="Швидкі дії"
      >
        Швидкі дії
      </summary>
      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-[var(--enver-border)]/60 p-1.5">
        {showCall && tel ? (
          <a href={`tel:${tel}`} className={baseBtn}>
            <Phone className="h-4 w-4" aria-hidden />
            Подзвонити
          </a>
        ) : null}
        <button
          type="button"
          className={baseBtn}
          onClick={onFocusNotesTab}
        >
          <StickyNote className="h-4 w-4" aria-hidden />
          Нотатки
        </button>
        {canUploadLeadFiles ? (
          <button
            type="button"
            className={baseBtn}
            onClick={onUploadClick}
          >
            <FileUp className="h-4 w-4" aria-hidden />
            Додати файл
          </button>
        ) : null}
        {showMeasure ? (
          <button
            type="button"
            className={`${baseBtn} leadhub-btn-primary`}
            onClick={onScheduleMeasure}
          >
            <Calendar className="h-4 w-4" aria-hidden />
            Планувати замір
          </button>
        ) : null}
        {showConvert && canConvertAction ? (
          <button
            type="button"
            className={`${baseBtn} leadhub-btn-success`}
            disabled={convertingToDeal}
            onClick={onConvertToDeal}
          >
            {convertingToDeal ? "..." : "Створити замовлення"}
          </button>
        ) : null}
        {canArchiveAction ? (
          <button
            type="button"
            className="leadhub-btn enver-press inline-flex h-9 min-w-[106px] items-center justify-center rounded-[10px] px-2.5 text-[11px] font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={archiving}
            onClick={onArchiveLead}
          >
            {archiving ? "..." : "Архівувати"}
          </button>
        ) : null}
        {canDeleteAction ? (
          <button
            type="button"
            className={`${baseBtn} leadhub-btn-danger`}
            disabled={deletingLead}
            onClick={onDeleteLead}
          >
            {deletingLead ? "..." : "Видалити"}
          </button>
        ) : null}
        {showMessages ? (
          <Link
            href={`/leads/${leadId}/messages`}
            className={baseBtn}
          >
            <MessageSquareText className="h-4 w-4" aria-hidden />
            Повідомлення
          </Link>
        ) : null}
      </div>
    </details>
  );
}
