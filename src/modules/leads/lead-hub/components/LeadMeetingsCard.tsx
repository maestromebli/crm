"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import Link from "next/link";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { dateToNextStepDateString } from "../../../../lib/leads/next-step-date";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
  onSchedule: () => void;
  canUpdateLead: boolean;
  measurementNotRequired: boolean;
  onMarkMeasurementNotRequired: () => void;
  markingMeasurementNotRequired: boolean;
};

const TYPE_UA: Record<string, string> = {
  MEETING: "Зустріч",
  MEASUREMENT: "Замір",
  INSTALLATION: "Монтаж",
  DELIVERY: "Доставка",
  OTHER: "Інше",
};

export function LeadMeetingsCard({
  lead,
  onSchedule,
  canUpdateLead,
  measurementNotRequired,
  onMarkMeasurementNotRequired,
  markingMeasurementNotRequired,
}: Props) {
  const now = new Date();
  const upcoming = lead.calendarEvents.filter(
    (e) => new Date(e.startAt) >= now,
  );
  const past = lead.calendarEvents.filter((e) => new Date(e.endAt) < now);
  const next = upcoming[0];
  const nextContact = dateToNextStepDateString(lead.nextContactAt);

  const measurementUpcoming = upcoming.filter((e) => e.type === "MEASUREMENT");
  const measurementDone = lead.calendarEvents.filter(
    (e) =>
      e.type === "MEASUREMENT" &&
      (e.status === "COMPLETED" || new Date(e.endAt) < now),
  );

  return (
    <section
      id="lead-meetings"
      className="space-y-5 rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]"
    >
      <div>
        <h3 className="text-[18px] font-semibold text-[var(--enver-text)]">
          Замір і об’єкт
        </h3>
        <p className="mt-0.5 text-[12px] text-[var(--enver-muted)]">
          Планування виїзду та зафіксовані результати (меблевий цикл).
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
          1. Планування
        </p>
        {next ? (
          <div
            className={cn(
              "mt-2 rounded-[12px] border border-[#BFDBFE] bg-[var(--enver-accent-soft)] px-3 py-2.5 text-[13px]",
            )}
          >
            <p className="text-[10px] font-semibold uppercase text-[var(--enver-accent-hover)]">
              Найближча подія
            </p>
            <p className="font-medium text-[var(--enver-text)]">{next.title}</p>
            <p className="text-[var(--enver-text-muted)]">
              {TYPE_UA[next.type] ?? next.type} ·{" "}
              {format(new Date(next.startAt), "d MMM yyyy, HH:mm", {
                locale: uk,
              })}
            </p>
          </div>
        ) : nextContact ? (
          <p className="mt-2 text-[13px] text-[var(--enver-text-muted)]">
            Календар порожній — наступний контакт:{" "}
            <span className="font-medium text-[var(--enver-text)]">
              {nextContact}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-[var(--enver-muted)]">
            Немає запланованих подій.
          </p>
        )}
        {measurementUpcoming.length > 1 ? (
          <ul className="mt-2 space-y-1 text-[12px] text-[var(--enver-text-muted)]">
            {measurementUpcoming.slice(1, 4).map((e) => (
              <li key={e.id}>
                · {e.title}{" "}
                {format(new Date(e.startAt), "d MMM HH:mm", { locale: uk })}
              </li>
            ))}
          </ul>
        ) : null}
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
          <button
            type="button"
            disabled={!canUpdateLead || measurementNotRequired || markingMeasurementNotRequired}
            onClick={() => onMarkMeasurementNotRequired()}
            className={cn(
              "rounded-[12px] border px-3 py-2 text-[12px] font-medium transition duration-200",
              !canUpdateLead || measurementNotRequired || markingMeasurementNotRequired
                ? "cursor-not-allowed border-[var(--enver-border)] bg-[var(--enver-card)] text-[var(--enver-muted)]"
                : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400",
            )}
          >
            {measurementNotRequired ? "Позначено: замір не потрібен" : "Попередній замір не потрібен"}
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--enver-border)] pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
          2. Результати та історія
        </p>
        {measurementDone.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {measurementDone
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
              )
              .slice(0, 6)
              .map((e) => (
                <li
                  key={e.id}
                  className="rounded-[10px] border border-[var(--enver-border)] bg-[var(--enver-bg)] px-3 py-2 text-[12px]"
                >
                  <span className="font-medium text-[var(--enver-text)]">
                    {e.title}
                  </span>
                  <span className="text-[var(--enver-text-muted)]">
                    {" "}
                    · {format(new Date(e.startAt), "d MMM yyyy", { locale: uk })}{" "}
                    · {e.status === "COMPLETED" ? "завершено" : "минуле"}
                  </span>
                </li>
              ))}
          </ul>
        ) : past.length > 0 ? (
          <p className="mt-2 text-[12px] text-[var(--enver-text-muted)]">
            Інші минулі події:{" "}
            {past
              .slice(-3)
              .map((e) => e.title)
              .join(" · ")}
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-[var(--enver-muted)]">
            Ще немає завершених замірів — після виїзду фіксуйте матеріали у
            {" "}
            <Link
              href={`/leads/${lead.id}/files`}
              className="font-medium text-[var(--enver-accent)] transition duration-200 hover:underline"
            >
              вкладці «Файли»
            </Link>
            {" "}та розрахунок у{" "}
            <Link
              href={`/leads/${lead.id}/pricing`}
              className="font-medium text-[var(--enver-accent)] transition duration-200 hover:underline"
            >
              «Розрахунок»
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
