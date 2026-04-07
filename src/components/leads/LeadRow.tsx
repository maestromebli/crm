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
    <tr className="transition-colors hover:bg-sky-50/40">
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/leads/${lead.id}`}
            className="font-semibold text-[var(--enver-text)] hover:text-sky-800 hover:underline"
          >
            {lead.title}
          </Link>
          {level === "critical" ? (
            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-800">
              Критично
            </span>
          ) : level === "warning" ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-900">
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
            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
            rs.key === "OVERDUE_TOUCH"
              ? "bg-rose-100 text-rose-900"
              : rs.key === "SCHEDULED"
                ? "bg-sky-100 text-sky-900"
                : rs.key === "CLOSED"
                  ? "bg-slate-100 text-slate-700"
                  : "bg-slate-100 text-slate-700",
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-[var(--enver-hover)]"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-slate-100 text-slate-300">
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          )}
          <Link
            href={`/leads/${lead.id}/messages`}
            title="Діалог"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-[var(--enver-hover)]"
          >
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
          <Link
            href={`/leads/${lead.id}/tasks?new=1`}
            title="Задача"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-[var(--enver-hover)]"
          >
            <CheckSquare className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
          <Link
            href={`/leads/${lead.id}#lead-convert`}
            title="У угоду"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-[var(--enver-hover)]"
          >
            <KanbanSquare className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>
      </td>
    </tr>
  );
}
