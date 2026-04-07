"use client";

import { Calendar, FileUp, Phone, StickyNote } from "lucide-react";
import Link from "next/link";
import { cn } from "../../../../lib/utils";

type Props = {
  leadId: string;
  phone: string | null;
  canUploadLeadFiles: boolean;
  onUploadClick: () => void;
  onScheduleMeasure: () => void;
  onFocusNotesTab: () => void;
  className?: string;
};

const btn =
  "enver-press inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--enver-border)] bg-[var(--enver-bg)] text-[var(--enver-text)] transition hover:border-[var(--enver-border-strong)] hover:bg-[var(--enver-surface)]";

export function LeadHubHeaderQuickActions({
  leadId,
  phone,
  canUploadLeadFiles,
  onUploadClick,
  onScheduleMeasure,
  onFocusNotesTab,
  className,
}: Props) {
  const tel = phone?.replace(/\s+/g, "");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-1.5",
        className,
      )}
      aria-label="Швидкі дії"
    >
      {tel ? (
        <a href={`tel:${tel}`} className={btn} title="Подзвонити">
          <Phone className="h-4 w-4" aria-hidden />
        </a>
      ) : null}
      <button
        type="button"
        className={btn}
        title="Нотатки"
        onClick={onFocusNotesTab}
      >
        <StickyNote className="h-4 w-4" aria-hidden />
      </button>
      {canUploadLeadFiles ? (
        <button
          type="button"
          className={btn}
          title="Завантажити файл"
          onClick={onUploadClick}
        >
          <FileUp className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className={btn}
        title="Запланувати замір"
        onClick={onScheduleMeasure}
      >
        <Calendar className="h-4 w-4" aria-hidden />
      </button>
      <Link
        href={`/leads/${leadId}/messages`}
        className="enver-press inline-flex h-9 items-center justify-center rounded-[10px] border border-[var(--enver-border)] bg-[var(--enver-bg)] px-2.5 text-[11px] font-medium text-[var(--enver-text)] hover:border-[var(--enver-border-strong)]"
        title="Повна стрічка повідомлень"
      >
        Стрічка
      </Link>
    </div>
  );
}
