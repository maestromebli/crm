"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import Link from "next/link";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { dateToNextStepDateString } from "../../../../lib/leads/next-step-date";

type Props = {
  lead: LeadDetailRow;
  onSchedule: () => void;
};

const TYPE_UA: Record<string, string> = {
  MEETING: "Зустріч",
  MEASUREMENT: "Замір",
  INSTALLATION: "Монтаж",
  DELIVERY: "Доставка",
  OTHER: "Інше",
};

export function LeadMeetingsCard({ lead, onSchedule }: Props) {
  const now = new Date();
  const upcoming = lead.calendarEvents.filter(
    (e) => new Date(e.startAt) >= now,
  );
  const past = lead.calendarEvents.filter((e) => new Date(e.endAt) < now);
  const next = upcoming[0];
  const last = past[past.length - 1];
  const nextContact = dateToNextStepDateString(lead.nextContactAt);

  return (
    <section
      id="lead-meetings"
      className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]"
    >
      <h3 className="text-[18px] font-medium text-[var(--enver-text)]">Календар</h3>
      <p className="mt-0.5 text-[12px] text-[var(--enver-muted)]">
        Найближча подія та останній результат
      </p>
      {next ? (
        <div className="mt-2 rounded-[12px] border border-[#BFDBFE] bg-[var(--enver-accent-soft)] px-3 py-2 text-[13px]">
          <p className="text-[10px] font-semibold uppercase text-[var(--enver-accent-hover)]">
            Найближче
          </p>
          <p className="font-medium text-[var(--enver-text)]">{next.title}</p>
          <p className="text-[var(--enver-text-muted)]">
            {TYPE_UA[next.type] ?? next.type} ·{" "}
            {format(new Date(next.startAt), "d MMM yyyy, HH:mm", { locale: uk })}
          </p>
        </div>
      ) : nextContact ? (
        <p className="mt-2 text-[13px] text-[var(--enver-text-muted)]">
          У календарі порожньо — наступний контакт з картки:{" "}
          <span className="font-medium text-[var(--enver-text)]">{nextContact}</span>
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-[var(--enver-muted)]">
          Немає запланованих подій для цього ліда.
        </p>
      )}
      {last ? (
        <p className="mt-2 text-[12px] text-[var(--enver-text-muted)]">
          <span className="font-medium text-[var(--enver-text)]">Останній результат: </span>
          {last.title} ·{" "}
          {format(new Date(last.startAt), "d MMM", { locale: uk })}
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-[var(--enver-muted)]">Минулі події відсутні.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSchedule()}
          className="enver-press rounded-[12px] bg-[#2563EB] px-3 py-2 text-[12px] font-medium text-white transition duration-200 hover:bg-[#1D4ED8]"
        >
          Запланувати замір
        </button>
        <Link
          href="/calendar"
          className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-2 text-[12px] font-medium text-[var(--enver-text)] transition duration-200 hover:border-[var(--enver-border-strong)]"
        >
          Календар
        </Link>
      </div>
    </section>
  );
}
