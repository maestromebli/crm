import type { LeadCtaActionKey, LeadCheckId, LeadRiskProfileTag, LeadStageGroup, LeadStageKey } from "./lead-stage.types";

export type StageConfigEntry = {
  key: LeadStageKey;
  labelUa: string;
  descriptionUa: string;
  group: LeadStageGroup;
  dominantCta: {
    labelUa: string;
    actionKey: LeadCtaActionKey;
    routePattern: string | null;
    anchorSection: string | null;
  };
  requiredChecks: LeadCheckId[];
  softChecks: LeadCheckId[];
  /** Allowed canonical transitions (subset; terminals usually []). */
  allowedNext: LeadStageKey[];
  riskProfile: LeadRiskProfileTag[];
  /** Keys into `lead-ai-hints` templates. */
  aiHintProfile: string[];
};

export const LEAD_STAGE_GROUPS: { key: LeadStageGroup; labelUa: string }[] = [
  { key: "intake", labelUa: "Надходження" },
  { key: "qualification", labelUa: "Кваліфікація" },
  { key: "site_work", labelUa: "Об’єкт / замір" },
  { key: "pricing", labelUa: "Розрахунок" },
  { key: "proposal", labelUa: "КП" },
  { key: "closing", labelUa: "Закриття ліда" },
  { key: "handoff", labelUa: "Передача у виробництво" },
  { key: "terminal", labelUa: "Фінал" },
];

/** Central metadata per canonical stage. */
export const LEAD_STAGE_CONFIG: Record<LeadStageKey, StageConfigEntry> = {
  NEW: {
    key: "NEW",
    labelUa: "Нові",
    descriptionUa: "Лід щойно потрапив у CRM — потрібен перший контакт.",
    group: "intake",
    dominantCta: {
      labelUa: "Зв’язатися з клієнтом",
      actionKey: "contact_client",
      routePattern: "/leads/:leadId",
      anchorSection: "communication",
    },
    requiredChecks: ["source_set", "contact_channel", "owner_assigned"],
    softChecks: ["next_step_text"],
    allowedNext: ["CONTACT", "MEASUREMENT", "LOST", "ARCHIVED"],
    riskProfile: ["early_funnel"],
    aiHintProfile: ["new_no_touch", "sla_new"],
  },
  CONTACT: {
    key: "CONTACT",
    labelUa: "Контакт",
    descriptionUa: "Йде діалог: збираємо запит, домовляємось про замір або розрахунок.",
    group: "qualification",
    dominantCta: {
      labelUa: "Запланувати замір",
      actionKey: "schedule_measurement",
      routePattern: "/leads/:leadId",
      anchorSection: "meetings",
    },
    requiredChecks: [
      "needs_summary",
      "furniture_or_object_type",
      "next_step_text",
      "measurement_decision_recorded",
    ],
    softChecks: ["budget_range_documented", "next_contact_date"],
    allowedNext: ["MEASUREMENT", "CALCULATION", "LOST", "ARCHIVED"],
    riskProfile: ["early_funnel", "pricing"],
    aiHintProfile: ["qual_incomplete", "budget_missing"],
  },
  MEASUREMENT: {
    key: "MEASUREMENT",
    labelUa: "Замір",
    descriptionUa: "Візит на об’єкт: фіксуємо розміри та матеріали для прорахунку.",
    group: "site_work",
    dominantCta: {
      labelUa: "Створити розрахунок",
      actionKey: "open_estimate",
      routePattern: "/leads/:leadId/estimate",
      anchorSection: null,
    },
    requiredChecks: [
      "measurement_scheduled_or_done",
      "site_address_or_context",
      "owner_assigned",
      "measurement_notes_or_sheet",
    ],
    softChecks: ["key_files_present"],
    allowedNext: ["CALCULATION", "CONTACT", "LOST", "ARCHIVED"],
    riskProfile: ["site_visit"],
    aiHintProfile: ["measurement_no_sheet", "no_photos"],
  },
  CALCULATION: {
    key: "CALCULATION",
    labelUa: "Розрахунок",
    descriptionUa: "Готуємо версії смети та узгоджуємо склад.",
    group: "pricing",
    dominantCta: {
      labelUa: "Створити КП",
      actionKey: "create_proposal",
      routePattern: "/leads/:leadId/estimate",
      anchorSection: "pricing",
    },
    requiredChecks: ["estimate_exists", "active_estimate"],
    softChecks: ["budget_range_documented"],
    allowedNext: ["QUOTE_DRAFT", "QUOTE_SENT", "LOST", "ARCHIVED"],
    riskProfile: ["pricing"],
    aiHintProfile: ["no_active_estimate", "draft_estimate"],
  },
  QUOTE_DRAFT: {
    key: "QUOTE_DRAFT",
    labelUa: "Чернетка КП",
    descriptionUa: "КП готується на базі активної смети.",
    group: "proposal",
    dominantCta: {
      labelUa: "Надіслати КП",
      actionKey: "send_proposal",
      routePattern: "/leads/:leadId/estimate",
      anchorSection: "proposal",
    },
    requiredChecks: ["active_estimate", "proposal_draft_linked"],
    softChecks: ["proposal_sent"],
    allowedNext: ["QUOTE_SENT", "APPROVED", "CALCULATION", "LOST", "ARCHIVED"],
    riskProfile: ["negotiation"],
    aiHintProfile: ["proposal_not_linked", "snapshot_stale"],
  },
  QUOTE_SENT: {
    key: "QUOTE_SENT",
    labelUa: "Надіслані КП",
    descriptionUa: "КП у клієнта — чекаємо зворотний зв’язок.",
    group: "proposal",
    dominantCta: {
      labelUa: "Запланувати follow-up",
      actionKey: "schedule_followup",
      routePattern: "/leads/:leadId",
      anchorSection: "next-action",
    },
    requiredChecks: ["proposal_sent", "follow_up_scheduled"],
    softChecks: ["next_contact_date"],
    allowedNext: ["APPROVED", "QUOTE_DRAFT", "LOST", "ARCHIVED"],
    riskProfile: ["negotiation"],
    aiHintProfile: ["quote_stalled", "no_followup_date"],
  },
  APPROVED: {
    key: "APPROVED",
    labelUa: "Погоджені",
    descriptionUa: "Умови КП прийняті — готуємо конверсію в угоду.",
    group: "closing",
    dominantCta: {
      labelUa: "Конвертувати в угоду",
      actionKey: "convert_to_deal",
      routePattern: "/leads/:leadId",
      anchorSection: "hub",
    },
    requiredChecks: ["proposal_approved", "approved_amount_documented"],
    softChecks: ["contact_channel", "owner_assigned"],
    allowedNext: [
      "CLIENT",
      "CONTRACT",
      "DEAL",
      "PRODUCTION_READY",
      "LOST",
      "ARCHIVED",
    ],
    riskProfile: ["closing"],
    aiHintProfile: ["pre_conversion", "approved_check_deal"],
  },
  CLIENT: {
    key: "CLIENT",
    labelUa: "Клієнти",
    descriptionUa: "Постійний контакт після узгодження умов.",
    group: "closing",
    dominantCta: {
      labelUa: "Відкрити картку клієнта",
      actionKey: "open_client_card",
      routePattern: "/leads/:leadId",
      anchorSection: "contact",
    },
    requiredChecks: ["contact_channel", "proposal_approved"],
    softChecks: ["next_step_text"],
    allowedNext: ["CONTRACT", "CONTROL_MEASUREMENT", "DEAL", "LOST", "ARCHIVED"],
    riskProfile: ["closing"],
    aiHintProfile: ["client_nurture"],
  },
  CONTROL_MEASUREMENT: {
    key: "CONTROL_MEASUREMENT",
    labelUa: "Контрольний замір",
    descriptionUa: "Додатковий виїзд перед виробництвом.",
    group: "site_work",
    dominantCta: {
      labelUa: "Запланувати контрольний замір",
      actionKey: "schedule_control_measurement",
      routePattern: "/leads/:leadId",
      anchorSection: "meetings",
    },
    requiredChecks: ["measurement_scheduled_or_done", "site_address_or_context"],
    softChecks: ["measurement_notes_or_sheet"],
    allowedNext: ["PRODUCTION_READY", "CONTRACT", "LOST", "ARCHIVED"],
    riskProfile: ["site_visit", "handoff"],
    aiHintProfile: ["control_measure_reminder"],
  },
  CONTRACT: {
    key: "CONTRACT",
    labelUa: "Договори",
    descriptionUa: "Юридичне оформлення перед виробництвом.",
    group: "closing",
    dominantCta: {
      labelUa: "Перейти до договору в угоді",
      actionKey: "open_contract",
      routePattern: "/deals/:dealId/workspace",
      anchorSection: "contract",
    },
    requiredChecks: ["proposal_approved", "approved_amount_documented"],
    softChecks: ["follow_up_scheduled"],
    allowedNext: ["DEAL", "PRODUCTION_READY", "LOST", "ARCHIVED"],
    riskProfile: ["closing", "handoff"],
    aiHintProfile: ["contract_pending"],
  },
  DEAL: {
    key: "DEAL",
    labelUa: "Угода",
    descriptionUa: "Лід конвертовано; основна робота в картці угоди.",
    group: "handoff",
    dominantCta: {
      labelUa: "Відкрити угоду",
      actionKey: "open_deal",
      routePattern: "/deals/:dealId/workspace",
      anchorSection: null,
    },
    requiredChecks: [],
    softChecks: [],
    allowedNext: ["PRODUCTION_READY", "ARCHIVED"],
    riskProfile: ["handoff"],
    aiHintProfile: ["deal_created"],
  },
  PRODUCTION_READY: {
    key: "PRODUCTION_READY",
    labelUa: "Готово до передачі у виробництво",
    descriptionUa: "Пакет для виробництва зібрано.",
    group: "handoff",
    dominantCta: {
      labelUa: "Підтвердити готовність до виробництва",
      actionKey: "confirm_production_ready",
      routePattern: "/deals/:dealId/workspace",
      anchorSection: "handoff",
    },
    requiredChecks: ["proposal_approved", "approved_amount_documented"],
    softChecks: ["key_files_present"],
    allowedNext: ["ARCHIVED"],
    riskProfile: ["handoff"],
    aiHintProfile: ["production_gate"],
  },
  LOST: {
    key: "LOST",
    labelUa: "Втрачено",
    descriptionUa: "Лід закрито без угоди.",
    group: "terminal",
    dominantCta: {
      labelUa: "Переглянути причини",
      actionKey: "review_stalled",
      routePattern: "/leads/:leadId",
      anchorSection: "communication",
    },
    requiredChecks: [],
    softChecks: [],
    allowedNext: [],
    riskProfile: ["terminal"],
    aiHintProfile: ["terminal_lost"],
  },
  ARCHIVED: {
    key: "ARCHIVED",
    labelUa: "Архів",
    descriptionUa: "Лід архівовано (конверсія або закриття).",
    group: "terminal",
    dominantCta: {
      labelUa: "Відкрити запис",
      actionKey: "review_stalled",
      routePattern: "/leads/:leadId",
      anchorSection: null,
    },
    requiredChecks: [],
    softChecks: [],
    allowedNext: [],
    riskProfile: ["terminal"],
    aiHintProfile: ["terminal_archived"],
  },
  UNKNOWN: {
    key: "UNKNOWN",
    labelUa: "Невідома стадія",
    descriptionUa: "Стадія не зіставлена з канонічною моделлю — уточніть налаштування воронки.",
    group: "intake",
    dominantCta: {
      labelUa: "Уточнити стадію вручну",
      actionKey: "review_stalled",
      routePattern: "/leads/:leadId",
      anchorSection: null,
    },
    requiredChecks: ["owner_assigned", "contact_channel"],
    softChecks: ["next_step_text"],
    allowedNext: ["CONTACT", "NEW", "CALCULATION", "LOST", "ARCHIVED"],
    riskProfile: ["early_funnel"],
    aiHintProfile: ["unknown_stage"],
  },
};

export function getStageConfig(key: LeadStageKey): StageConfigEntry {
  return LEAD_STAGE_CONFIG[key] ?? LEAD_STAGE_CONFIG.UNKNOWN;
}
