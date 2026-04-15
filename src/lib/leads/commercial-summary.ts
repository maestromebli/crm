import type { LeadDetailRow } from "../../features/leads/queries";

export type CommercialWarning = {
  key: string;
  message: string;
  tone: "info" | "warn" | "risk";
};

export type CommercialNextAction = {
  key: string;
  label: string;
  reason: string;
};

/** Попередження та наступні кроки з комерційного стану ліда (без зовнішніх API). */
export function deriveCommercialWarnings(lead: LeadDetailRow): CommercialWarning[] {
  const out: CommercialWarning[] = [];
  const est = lead.estimates[0];
  const prop = lead.proposals[0];

  if (prop?.estimateId && est?.id && prop.estimateId !== est.id) {
    out.push({
      key: "proposal_not_on_latest_estimate",
      message:
        "Актуальна смета змінилась — створіть нове КП від поточної версії.",
      tone: "warn",
    });
  }

  if (prop?.status === "SENT" && prop.sentAt) {
    const days =
      (Date.now() - new Date(prop.sentAt).getTime()) / (86400 * 1000);
    if (days > 3) {
      out.push({
        key: "stale_proposal_followup",
        message: "КП надіслано більше 3 днів тому — заплануйте повторний контакт.",
        tone: "info",
      });
    }
  }

  if (est?.status === "DRAFT" && lead.proposals[0]?.status === "SENT") {
    out.push({
      key: "draft_estimate_sent_proposal",
      message: "Смета ще чернетка, а КП уже відправляли — перевірте актуальність.",
      tone: "warn",
    });
  }

  return out;
}

export function deriveCommercialNextActions(
  lead: LeadDetailRow,
): CommercialNextAction[] {
  const actions: CommercialNextAction[] = [];
  const est = lead.estimates[0];
  const prop = lead.proposals[0];

  if (!est) {
    actions.push({
      key: "create_estimate",
      label: "Створити прорахунок",
      reason: "Без смети важко фіксувати ціну та КП.",
    });
    return actions;
  }

  if (!prop) {
    actions.push({
      key: "create_proposal",
      label: "Створити КП з поточної смети",
      reason: "Закрити угоду легше з офером на основі цифр.",
    });
  }

  if (prop?.status === "DRAFT" && est.id === prop.estimateId) {
    actions.push({
      key: "pdf_share",
      label: "Згенерувати PDF і надіслати клієнту",
      reason: "Чернетка КП — експортуйте PDF і зафіксуйте відправку.",
    });
  }

  if (prop?.status === "SENT" || prop?.status === "CLIENT_REVIEWING") {
    actions.push({
      key: "follow_up",
      label: "Повторний контакт після КП",
      reason: "Зафіксуйте відповідь або наступний контакт.",
    });
  }

  return actions.slice(0, 4);
}
