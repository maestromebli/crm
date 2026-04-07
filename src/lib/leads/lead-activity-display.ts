import type { ActivityType } from "@prisma/client";

const TITLE_UA: Partial<Record<ActivityType, string>> = {
  LEAD_CREATED: "Лід створено",
  LEAD_UPDATED: "Оновлення картки",
  FILE_UPLOADED: "Файл додано",
  DEAL_CREATED: "Угоду створено",
  DEAL_UPDATED: "Угоду оновлено",
  DEAL_STAGE_CHANGED: "Стадію змінено",
  DEAL_WORKSPACE_META_UPDATED: "Робоче місце оновлено",
  CONTRACT_CREATED: "Договір створено",
  CONTRACT_STATUS_CHANGED: "Статус договору",
  TASK_CREATED: "Задача створена",
  TASK_COMPLETED: "Задача виконана",
  EVENT_CREATED: "Подія в календарі",
  EVENT_UPDATED: "Подія оновлена",
  HANDOFF_SUBMITTED: "Передача на виробництво",
  HANDOFF_ACCEPTED: "Передачу прийнято",
  HANDOFF_REJECTED: "Передачу відхилено",
  READINESS_SNAPSHOT_SAVED: "Знімок готовності",
};

const FIELD_UA: Record<string, string> = {
  title: "назва",
  source: "джерело",
  stageId: "стадія",
  ownerId: "відповідальний",
  priority: "пріоритет",
  contactName: "імʼя",
  phone: "телефон",
  email: "email",
  note: "нотатка",
  contactId: "контакт",
  pipelineId: "воронка",
  lastActivityAt: "остання активність",
  dealId: "угода",
  lostReason: "причина втрати",
  nextStepAt: "наступний крок",
};

const ATTACHMENT_CATEGORY_UA: Record<string, string> = {
  OBJECT_PHOTO: "фото обʼєкта",
  MEASUREMENT_SHEET: "заміри",
  BRIEF: "бриф",
  REFERENCE: "референс",
  CALCULATION: "розрахунок",
  QUOTE_PDF: "КП / PDF",
  CONTRACT: "договір",
  INVOICE: "рахунок",
  PAYMENT_CONFIRMATION: "підтвердження оплати",
  DRAWING: "креслення",
  SPEC: "специфікація",
  TECH_CARD: "техкартка",
  INSTALL_SCHEME: "схема монтажу",
  ACCEPTANCE_ACT: "акт прийому",
  RESULT_PHOTO: "фото результату",
  OTHER: "інше",
};

export type LeadActivityCategory = "file" | "dialog" | "card" | "system";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function leadActivityTitle(type: ActivityType): string {
  return TITLE_UA[type] ?? type.replace(/_/g, " ");
}

/** Короткий заголовок рядка в стрічці (може відрізнятися від типу для LEAD_UPDATED). */
export function leadActivityHeadline(
  type: ActivityType,
  data: unknown,
): string {
  if (type === "LEAD_UPDATED" && isRecord(data)) {
    if (data.note === "lead_message" || data.note === "messenger_outbound") {
      return data.note === "messenger_outbound"
        ? "Повідомлення (месенджер)"
        : "Запис у діалозі";
    }
    if (data.source === "ai_insight_auto") {
      return "Стадія за рекомендацією AI";
    }
    if (data.convertedToDealId) {
      return "Конверсія в угоду";
    }
    if (data.createdContactId) {
      return "Контакт привʼязано";
    }
  }
  return leadActivityTitle(type);
}

export function leadActivityCategory(
  type: ActivityType,
  data: unknown,
): LeadActivityCategory {
  if (type === "FILE_UPLOADED") return "file";
  if (type === "LEAD_CREATED") return "card";

  if (type === "LEAD_UPDATED" && isRecord(data)) {
    if (
      data.note === "lead_message" ||
      data.note === "messenger_outbound"
    ) {
      return "dialog";
    }
    if (data.source === "ai_insight_auto") return "system";
    return "card";
  }

  return "card";
}

export function sourceLabelUa(source: string): string {
  switch (source) {
    case "USER":
      return "дія користувача";
    case "SYSTEM":
      return "система";
    case "INTEGRATION":
      return "інтеграція";
    default:
      return source;
  }
}

export function leadActivityDetail(type: ActivityType, data: unknown): string {
  if (data == null || !isRecord(data)) {
    return "";
  }

  if (type === "LEAD_CREATED") {
    const parts: string[] = [];
    if (typeof data.title === "string" && data.title.trim()) {
      parts.push(`«${data.title.trim()}»`);
    }
    if (typeof data.source === "string" && data.source.trim()) {
      parts.push(`джерело: ${data.source}`);
    }
    return parts.join(" · ");
  }

  if (type === "FILE_UPLOADED") {
    const name =
      typeof data.fileName === "string" ? data.fileName.trim() : "";
    const cat =
      typeof data.category === "string"
        ? ATTACHMENT_CATEGORY_UA[data.category] ?? data.category
        : "";
    if (name && cat) return `${name} · ${cat}`;
    if (name) return name;
    if (cat) return cat;
    return "";
  }

  if (type === "LEAD_UPDATED") {
    if (data.note === "lead_message") {
      return "Додано запис у вкладці «Діалог».";
    }
    if (data.note === "messenger_outbound") {
      const ch =
        typeof data.channel === "string" ? ` (${data.channel})` : "";
      return `Вихідне повідомлення${ch}.`;
    }
    if (data.source === "ai_insight_auto") {
      return "Стадію оновлено автоматично за підсумком AI-аналізу.";
    }
    if (typeof data.convertedToDealId === "string") {
      return "Лід повʼязано з новою угодою — подальші дії ведуться в угоді.";
    }
    if (data.createdContactId) {
      return "Створено та привʼязано контакт до ліда.";
    }
    const fields = data.fields;
    if (Array.isArray(fields) && fields.length > 0) {
      const labels = fields
        .filter((f): f is string => typeof f === "string")
        .map((f) => FIELD_UA[f] ?? f.replace(/Id$/, "").replace(/_/g, " "))
        .filter(Boolean);
      if (labels.length === 1) {
        return `Змінено поле: ${labels[0]}.`;
      }
      if (labels.length > 1) {
        return `Оновлено: ${labels.slice(0, 5).join(", ")}${
          labels.length > 5 ? "…" : ""
        }.`;
      }
    }
    return "";
  }

  return "";
}
