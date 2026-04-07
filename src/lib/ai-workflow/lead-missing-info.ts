import type { LeadDetailRow } from "../../features/leads/queries";
import type { MissingInfoResult } from "./types";

function hasContact(lead: LeadDetailRow): boolean {
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || "";
  const email =
    lead.contact?.email?.trim() || lead.email?.trim() || "";
  return phone.length >= 9 || email.length > 3;
}

/**
 * Пропуски в картці ліда для чеклисту / AI-панелі (§3.4).
 */
export function deriveLeadMissingInfo(lead: LeadDetailRow): MissingInfoResult {
  const out: MissingInfoResult = [];
  const q = lead.qualification;

  if (!hasContact(lead)) {
    out.push({
      key: "contact",
      label: "Контакт",
      severity: "HIGH",
      reason: "Немає телефону чи email для звʼязку.",
      suggestion: "Додайте основний контакт або уточніть номер.",
    });
  }

  if (!q.budgetRange?.trim()) {
    out.push({
      key: "budget",
      label: "Бюджет",
      severity: "MEDIUM",
      reason: "Діапазон бюджету не зафіксовано.",
      suggestion: "Запитайте орієнтир по сумі.",
    });
  }

  if (!q.furnitureType?.trim() && !q.objectType?.trim()) {
    out.push({
      key: "project_type",
      label: "Тип проєкту / обʼєкт",
      severity: "MEDIUM",
      reason: "Немає типу меблів чи обʼєкта.",
      suggestion: "Кухня / шафа / комерція тощо.",
    });
  }

  const hasMeasurementSheet = lead.attachments.some(
    (a) => a.category === "MEASUREMENT_SHEET",
  );
  const hasMeasEvent = lead.calendarEvents.some(
    (e) => e.type === "MEASUREMENT" && e.status === "COMPLETED",
  );
  if (!hasMeasurementSheet && !hasMeasEvent && lead.estimates.length > 0) {
    out.push({
      key: "measurements",
      label: "Замір / креслення",
      severity: "LOW",
      reason: "Немає аркуша заміру серед файлів і завершеного заміру в календарі.",
      suggestion: "За потреби додайте фото/розміри обʼєкта.",
    });
  }

  if (lead.estimates.length === 0) {
    out.push({
      key: "estimate",
      label: "Смета",
      severity: "HIGH",
      reason: "Немає прорахунку.",
      suggestion: "Створіть чернетку смети.",
    });
  }

  const est = lead.estimates[0];
  const prop = lead.proposals[0];
  if (est && (!prop || prop.estimateId !== est.id)) {
    out.push({
      key: "proposal",
      label: "КП",
      severity: "MEDIUM",
      reason: "Немає КП за поточною сметою.",
      suggestion: "Згенеруйте КП з актуальної версії.",
    });
  }

  if (!lead.nextStep?.trim() || !lead.nextContactAt) {
    out.push({
      key: "next_step",
      label: "Наступний крок",
      severity: "MEDIUM",
      reason: "Не заповнено текст кроку або дату контакту.",
      suggestion: "Зафіксуйте конкретну дію в календарі.",
    });
  }

  return out;
}
