import Link from "next/link";
import {
  CheckSquare,
  KanbanSquare,
  MessageSquare,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import type { LeadListRow } from "../../features/leads/queries";
import {
  leadResponseStatus,
  leadWarningLevel,
} from "../../lib/leads/lead-row-meta";
import { normalizePhoneDigits } from "../../lib/leads/phone-normalize";
import { cn } from "../../lib/utils";

export function telHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const t = phone.trim();
  if (t.startsWith("+")) return `tel:${t.replace(/\s/g, "")}`;
  const d = normalizePhoneDigits(t);
  if (d.length < 9) return null;
  return `tel:+${d}`;
}

type LeadRowProps = {
  lead: LeadListRow;
  duplicatePhone: boolean;
};

export function LeadRow({ lead, duplicatePhone }: LeadRowProps) {
  const meta = lead;
  const rs = leadResponseStatus(meta);
  const { level, hints } = leadWarningLevel(meta, duplicatePhone);
  const tel = telHref(lead.contact?.phone ?? lead.phone ?? null);
  const phoneDisplay =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;

  return (
    <tr className="transition-colors hover:bg-[var(--enver-hover)]/70">
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/leads/${lead.id}`}
            className="font-semibold text-[var(--enver-text)] hover:text-[var(--enver-accent-hover)] hover:underline"
          >
            {lead.title}
          </Link>
          {level === "critical" ? (
            <span className="rounded-full border border-rose-200/70 bg-rose-50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-rose-800">
              Критично
            </span>
          ) : level === "warning" ? (
            <span className="rounded-full border border-amber-200/70 bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-900">
              Увага
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[10px] text-slate-500">
          <span className="font-medium text-slate-600">{lead.stage.name}</span>
          {" · "}
          {lead.source}
          {" · "}
          {lead.owner.name ?? lead.owner.email}
        </p>
        {phoneDisplay ? (
          <p className="mt-0.5 text-[10px] tabular-nums text-slate-500">
            {phoneDisplay}
          </p>
        ) : null}
        {hints.length ? (
          <p className="mt-1 text-[10px] text-slate-600">
            {hints.join(" · ")}
          </p>
        ) : null}
      </td>
      <td className="max-w-[10rem] px-3 py-2.5 align-top text-slate-700">
        {lead.nextStep?.trim() ? (
          <span className="line-clamp-2">{lead.nextStep}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 align-top text-slate-600">
        {lead.nextContactAt
          ? format(new Date(lead.nextContactAt), "d MMM HH:mm", {
              locale: uk,
            })
          : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 align-top text-slate-600">
        {lead.lastActivityAt
          ? format(new Date(lead.lastActivityAt), "d MMM HH:mm", {
              locale: uk,
            })
          : "—"}
      </td>
      <td className="px-3 py-2.5 align-top">
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
            rs.key === "OVERDUE_TOUCH"
              ? "border-rose-200/70 bg-rose-50 text-rose-900"
              : rs.key === "SCHEDULED"
                ? "border-sky-200/70 bg-sky-50 text-sky-900"
                : rs.key === "CLOSED"
                  ? "border-[var(--enver-border)] bg-[var(--enver-surface)] text-slate-700"
                  : "border-[var(--enver-border)] bg-[var(--enver-surface)] text-slate-700",
          )}
        >
          {rs.label}
        </span>
      </td>
      <td className="px-3 py-2.5 align-top text-right">
        <div className="flex justify-end gap-1">
          {tel ? (
            <a
              href={tel}
              title="Дзвінок"
              aria-label={`Подзвонити клієнту по лідy ${lead.title}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-[var(--enver-hover)]"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          ) : (
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-slate-100 text-slate-300"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          )}
          <Link
            href={`/leads/${lead.id}/messages`}
            title="Діалог"
            aria-label={`Відкрити повідомлення для ліда ${lead.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-[var(--enver-hover)]"
          >
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
          <Link
            href={`/leads/${lead.id}/tasks?new=1`}
            title="Задача"
            aria-label={`Створити задачу для ліда ${lead.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-[var(--enver-hover)]"
          >
            <CheckSquare className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
          <Link
            href={`/leads/${lead.id}#lead-convert`}
            title="В замовлення"
            aria-label={`Конвертувати лід ${lead.title} в замовлення`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-[var(--enver-hover)]"
          >
            <KanbanSquare className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>
      </td>
    </tr>
  );
}
