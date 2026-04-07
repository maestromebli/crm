import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LeadDetailRow } from "../../../features/leads/queries";

type LeadHeaderProps = {
  lead: LeadDetailRow;
};

/** Мінімальний хлібний шлях; основний робочий блок — Lead Hub нижче. */
export function LeadHeader({ lead }: LeadHeaderProps) {
  const displayName =
    lead.contact?.fullName?.trim() || lead.contactName?.trim() || lead.title;

  return (
    <header className="mb-1">
      <nav
        className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--enver-muted)]"
        aria-label="Навігація по лідах"
      >
        <Link
          href="/leads"
          className="rounded-[12px] px-1.5 py-0.5 font-medium text-[var(--enver-text-muted)] transition duration-200 hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]"
        >
          Ліди
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0 text-[#D1D5DB]" aria-hidden />
        <span className="max-w-[min(100%,20rem)] truncate font-medium text-[var(--enver-text)]">
          {displayName}
        </span>
        <span
          className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-card)] px-2 py-0.5 text-[10px] font-medium text-[var(--enver-muted)]"
          title="Стадія воронки"
        >
          {lead.stage.name}
        </span>
      </nav>
    </header>
  );
}
