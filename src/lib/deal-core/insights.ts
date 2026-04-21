import type { DealContractStatus } from "@prisma/client";
import type { DealWorkspaceMeta, DealWorkspacePayload } from "./workspace-types";

function contractLabel(s: DealContractStatus | null): string {
  if (!s) return "Договір ще не створено.";
  const map: Record<DealContractStatus, string> = {
    DRAFT: "Чернетка договору",
    GENERATED: "Договір згенеровано з шаблону",
    EDITED: "Договір відредаговано",
    PENDING_INTERNAL_APPROVAL: "Очікує внутрішнього погодження",
    APPROVED_INTERNAL: "Погоджено всередині компанії",
    SENT_FOR_SIGNATURE: "Надіслано на підпис",
    VIEWED_BY_CLIENT: "Клієнт переглянув документ",
    CLIENT_SIGNED: "Підпис клієнта отримано",
    COMPANY_SIGNED: "Підпис компанії отримано",
    FULLY_SIGNED: "Договір повністю підписано",
    DECLINED: "Підпис відхилено — потрібна нова версія",
    EXPIRED: "Строк підпису минув",
    SUPERSEDED: "Замінено новою версією",
  };
  return map[s];
}

const PRE_CONTRACT_SLUGS = new Set([
  "qualification",
  "measurement",
  "proposal",
]);

/** Системна рекомендація з урахуванням етапу продажу (не договір першим для ранніх стадій). */
export function deriveNextBestAction(data: DealWorkspacePayload): string {
  if (data.deal.status === "LOST") {
    return "Замовлення втрачена — за потреби зафіксуйте причину в нотатках.";
  }
  if (data.deal.status === "WON") {
    return "Замовлення виграна — контролюйте оплату та передачу у виробництво.";
  }
  if (data.deal.status === "ON_HOLD") {
    return "Замовлення на паузі — заплануйте повторний контакт (наступний крок + дата).";
  }

  const slug = data.stage.slug;

  if (!data.meta.qualificationComplete) {
    return "Завершіть кваліфікацію: бюджет, терміни, склад приміщення — у блоці «Продаж».";
  }

  if (!data.meta.measurementComplete) {
    if (
      PRE_CONTRACT_SLUGS.has(slug) ||
      slug === "contract" ||
      slug === "payment"
    ) {
      return "Зафіксуйте або заплануйте замір (фото, розміри) — блок «Продаж → Замір».";
    }
  }

  if (!data.meta.proposalSent) {
    if (!["won", "handoff", "production"].includes(slug)) {
      return "Підготуйте смету та надішліть КП клієнту — «Смета і задачі».";
    }
  }

  const c = data.contract;
  if (!c || c.status === "DRAFT") {
    return "Підготуйте договір після узгодження умов — блок «Замовлення → Договір».";
  }
  if (
    c.status === "GENERATED" ||
    c.status === "EDITED" ||
    c.status === "PENDING_INTERNAL_APPROVAL"
  ) {
    return "Завершіть погодження та надішліть договір на підпис.";
  }
  if (
    c.status === "SENT_FOR_SIGNATURE" ||
    c.status === "VIEWED_BY_CLIENT" ||
    c.status === "CLIENT_SIGNED"
  ) {
    return "Контролюйте підписання; нагадайте клієнту або підпишіть з боку компанії.";
  }
  if (c.status === "FULLY_SIGNED") {
    if (!data.readinessAllMet) {
      return "Закрийте умови готовності (оплата, файли) перед передачею.";
    }
    return "Умови виконані — оформіть передачу / виробництво у блоці «Після продажу».";
  }
  if (c.status === "DECLINED" || c.status === "EXPIRED") {
    return "Оновіть договір і повторіть цикл підпису.";
  }

  if (slug === "payment" || slug === "handoff" || slug === "production") {
    return "Контролюйте оплату, файли та передачу — блок «Замовлення» та «Після продажу».";
  }

  return "Оновіть наступний крок і дату контакту в шапці замовлення.";
}

export function deriveAiSummary(data: DealWorkspacePayload): string {
  const parts: string[] = [];
  parts.push(`Замовлення «${data.deal.title}», клієнт ${data.client.name}.`);
  parts.push(`Стадія воронки: ${data.stage.name}.`);
  parts.push(contractLabel(data.contract?.status ?? null));
  if (!data.readinessAllMet) {
    const n = data.readiness.filter((x) => !x.done).length;
    parts.push(`Відкрито ${n} пункт(ів) готовності до виробництва.`);
  } else {
    parts.push("Умови готовності до виробництва виконані.");
  }
  return parts.join(" ");
}

/** Текст для шапки: явний крок менеджера або системна підказка. */
export function deriveNextActionLabel(data: DealWorkspacePayload): string {
  const custom = data.meta.nextStepLabel?.trim();
  if (custom) return custom;
  return deriveNextBestAction(data);
}

export type NextStepSeverity = "ok" | "warning" | "danger";

export function deriveNextStepSeverity(
  meta: DealWorkspaceMeta,
): NextStepSeverity {
  const label = meta.nextStepLabel?.trim();
  const at = meta.nextActionAt ? new Date(meta.nextActionAt) : null;
  if (!label || !at || Number.isNaN(at.getTime())) return "danger";
  if (at.getTime() < Date.now()) return "warning";
  return "ok";
}
