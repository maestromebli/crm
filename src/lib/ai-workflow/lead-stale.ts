import type { LeadDetailRow } from "../../features/leads/queries";

const MS_DAY = 86_400_000;

/**
 * Пороги «застою» за стадією (дні без активності) — §3.3.
 * Slug порівнюються case-insensitive; невідомі стадії → 2 дн.
 */
export function staleThresholdDaysForStage(stageSlug: string): number {
  const s = stageSlug.toLowerCase();
  if (s === "new" || s.includes("contact")) return 1;
  if (
    s.includes("qualif") ||
    s.includes("estimat") ||
    s.includes("proposal") ||
    s.includes("комерц")
  ) {
    return 2;
  }
  if (s.includes("negot")) return 3;
  return 2;
}

function activityAnchor(lead: LeadDetailRow): Date {
  if (lead.lastActivityAt && !Number.isNaN(lead.lastActivityAt.getTime())) {
    return lead.lastActivityAt;
  }
  return lead.updatedAt;
}

/**
 * Текст про застій або `null`, якщо сигналів немає / лід фінальний.
 */
export function deriveStaleLeadSummary(lead: LeadDetailRow): string | null {
  if (lead.stage.isFinal) return null;

  const prop = lead.proposals[0];
  if (prop?.status === "SENT" && prop.sentAt) {
    const sinceSend = (Date.now() - prop.sentAt.getTime()) / MS_DAY;
    if (sinceSend >= 2 && !prop.viewedAt) {
      return `Після відправки КП минуло понад ${Math.floor(sinceSend)} дн., перегляд не зафіксовано.`;
    }
  }

  if (lead.nextContactAt && lead.nextContactAt.getTime() < Date.now()) {
    const overdue = (Date.now() - lead.nextContactAt.getTime()) / MS_DAY;
    return `Наступний крок прострочено на ~${Math.max(1, Math.floor(overdue))} дн.`;
  }

  const thr = staleThresholdDaysForStage(lead.stage.slug);
  const anchor = activityAnchor(lead);
  const days = (Date.now() - anchor.getTime()) / MS_DAY;
  if (days < thr) return null;

  if (prop?.status === "SENT" && prop.sentAt) {
    const sinceSend = (Date.now() - prop.sentAt.getTime()) / MS_DAY;
    if (sinceSend >= 2) {
      return `Лід застійний: після відправки КП минуло понад ${Math.floor(sinceSend)} дн. без руху.`;
    }
  }

  return `Лід застійний: немає активності ~${Math.floor(days)} дн. (поріг для стадії ${thr} дн.).`;
}
