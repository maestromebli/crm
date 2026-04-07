import type { LeadDetailRow } from "../../features/leads/queries";
import type { NextBestActionResult } from "./types";
import { staleThresholdDaysForStage } from "./lead-stale";

const MS_DAY = 86_400_000;

function hasSolidContact(lead: LeadDetailRow): boolean {
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || "";
  const email =
    lead.contact?.email?.trim() || lead.email?.trim() || "";
  return phone.length >= 9 || email.length > 3;
}

function daysBetweenNow(d: Date | null | undefined): number | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / MS_DAY;
}

function latestCompletedMeasurementAt(lead: LeadDetailRow): Date | null {
  const evs = lead.calendarEvents.filter(
    (e) => e.type === "MEASUREMENT" && e.status === "COMPLETED",
  );
  if (evs.length === 0) return null;
  let max = 0;
  for (const e of evs) {
    const t = new Date(e.endAt).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max ? new Date(max) : null;
}

function activityAnchor(lead: LeadDetailRow): Date {
  if (lead.lastActivityAt && !Number.isNaN(lead.lastActivityAt.getTime())) {
    return lead.lastActivityAt;
  }
  return lead.updatedAt;
}

/**
 * Один найкорисніший наступний крок (§3.2, адаптовано під ENVER).
 */
export function deriveLeadNextBestAction(
  lead: LeadDetailRow,
): NextBestActionResult | null {
  const slug = lead.stage.slug.toLowerCase();
  const ft = lead.stage.finalType;
  const isLost = ft === "LOST" || slug.includes("lost");
  const isWon = lead.stage.isFinal && ft === "WON";

  if (isLost) {
    return {
      title: "Зафіксуйте причину відмови",
      reason: "Лід у фінальній негативній стадії.",
      priority: "LOW",
      target: "communication",
      ctaLabel: "Нотатка",
    };
  }
  if (isWon || lead.dealId) {
    return {
      title: "Відкрийте угоду",
      reason: "Лід закрито позитивно або вже є угода.",
      priority: "LOW",
      target: "convert",
      ctaLabel: "Угода",
    };
  }

  if (!hasSolidContact(lead)) {
    return {
      title: "Додайте основний контакт",
      reason: "Немає стійкого телефону чи email для звʼязку.",
      priority: "HIGH",
      target: "contact",
      ctaLabel: "Контакт",
    };
  }

  const slugNew = slug === "new" || slug.endsWith("-new");
  if (slugNew && !lead.lastActivityAt) {
    return {
      title: "Звʼяжіться з клієнтом",
      reason: "Новий лід без зафіксованої активності.",
      priority: "HIGH",
      target: "communication",
      ctaLabel: "Контакт",
    };
  }

  if (
    lead.nextContactAt &&
    lead.nextStep?.trim() &&
    lead.nextContactAt.getTime() < Date.now()
  ) {
    return {
      title: "Завершіть прострочений наступний крок",
      reason: "Дата контакту минула — оновіть результат або перенесіть.",
      priority: "HIGH",
      target: "communication",
      ctaLabel: "Оновити крок",
    };
  }

  const measAt = latestCompletedMeasurementAt(lead);
  const est = lead.estimates[0];
  if (measAt && est && est.updatedAt.getTime() < measAt.getTime()) {
    return {
      title: "Оновіть смету після заміру",
      reason: "Замір завершено, смета старіша за дату заміру.",
      priority: "HIGH",
      target: "estimate",
      ctaLabel: "Смета",
    };
  }

  if (est && (!lead.proposals[0] || lead.proposals[0].estimateId !== est.id)) {
    return {
      title: "Створіть КП з поточної смети",
      reason: "Є актуальна смета без КП на її основі.",
      priority: "HIGH",
      target: "proposal",
      ctaLabel: "КП",
    };
  }

  const prop = lead.proposals[0];
  if (prop?.status === "SENT" && prop.sentAt) {
    const sinceSend = daysBetweenNow(prop.sentAt);
    if (sinceSend != null && sinceSend >= 2 && !prop.viewedAt) {
      return {
        title: "Нагадайте про КП",
        reason: "КП надіслано, перегляд не зафіксовано.",
        priority: "MEDIUM",
        target: "proposal",
        ctaLabel: "Follow-up",
      };
    }
  }

  if (
    prop &&
    prop.viewedAt &&
    prop.status !== "APPROVED" &&
    prop.status !== "REJECTED" &&
    prop.status !== "SUPERSEDED"
  ) {
    return {
      title: "Уточніть зворотний звʼязок",
      reason: "КП переглянуто, рішення не зафіксовано.",
      priority: "MEDIUM",
      target: "communication",
      ctaLabel: "Дзвінок",
    };
  }

  if (prop?.status === "APPROVED" && !lead.dealId) {
    return {
      title: "Конвертуйте в угоду",
      reason: "КП погоджено — наступний крок продажу.",
      priority: "HIGH",
      target: "convert",
      ctaLabel: "Конверсія",
    };
  }

  const thr = staleThresholdDaysForStage(lead.stage.slug);
  const inactiveDays = daysBetweenNow(activityAnchor(lead));
  if (inactiveDays != null && inactiveDays >= thr) {
    return {
      title: "Вийдіть на контакт",
      reason: `Немає руху ~${Math.floor(inactiveDays)} дн. (поріг для стадії ${thr} дн.).`,
      priority: "MEDIUM",
      target: "communication",
      ctaLabel: "Follow-up",
    };
  }

  return {
    title: "Оновіть наступний крок",
    reason: "Тримайте в картці конкретну дію і дату.",
    priority: "LOW",
    target: "communication",
    ctaLabel: "План",
  };
}
