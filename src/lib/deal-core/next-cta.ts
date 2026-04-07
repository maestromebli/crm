import type { DealContractStatus } from "@prisma/client";

import type { DealWorkspacePayload, DealWorkspaceTabId } from "./workspace-types";
import {
  derivePaymentMoneySummaryForPayload,
  derivePaymentStripSummaryForPayload,
} from "./payment-aggregate";

export type DealPrimaryCta = {
  label: string;
  tab: DealWorkspaceTabId;
  disabled: boolean;
  disabledReason: string | null;
};

/** Одна головна дія для командної панелі (українською). */
export function deriveDealPrimaryCta(data: DealWorkspacePayload): DealPrimaryCta {
  const c = data.contract?.status ?? null;
  const payStrip = derivePaymentStripSummaryForPayload(data);
  const payMoney = derivePaymentMoneySummaryForPayload(data);
  const tech = data.meta.technicalChecklist;
  const techDone =
    tech === undefined ||
    (Boolean(tech.finalDimensionsConfirmed) &&
      Boolean(tech.materialsConfirmed) &&
      Boolean(tech.fittingsConfirmed) &&
      Boolean(tech.drawingsAttached) &&
      Boolean(tech.clientApprovalsConfirmed) &&
      Boolean(tech.specialNotesDocumented));

  if (data.deal.status !== "OPEN") {
    return {
      label: "Переглянути угоду",
      tab: "overview",
      disabled: false,
      disabledReason: null,
    };
  }

  if (!data.contract || c === "DRAFT" || c === null) {
    return {
      label: "Створити договір",
      tab: "contract",
      disabled: false,
      disabledReason: null,
    };
  }

  if (c !== "FULLY_SIGNED" && c !== "SUPERSEDED") {
    const label =
      c === "SENT_FOR_SIGNATURE" ||
      c === "VIEWED_BY_CLIENT" ||
      c === "CLIENT_SIGNED"
        ? "Підписати договір"
        : "Надіслати на підпис";
    return {
      label,
      tab: "contract",
      disabled: false,
      disabledReason: null,
    };
  }

  if (payStrip.total === 0 || payStrip.variant === "empty") {
    return {
      label: "Створити графік оплат",
      tab: "payment",
      disabled: false,
      disabledReason: null,
    };
  }

  if (payStrip.variant === "unpaid" || payStrip.variant === "partial") {
    const label =
      payMoney.paid > 0 ? "Підтвердити оплату" : "Створити рахунок / підтвердити оплату";
    return {
      label,
      tab: "payment",
      disabled: false,
      disabledReason: null,
    };
  }

  const cm = data.controlMeasurement;
  if (!cm?.scheduledAt && !cm?.completedAt) {
    return {
      label: "Запланувати контрольний замір",
      tab: "measurement",
      disabled: false,
      disabledReason: null,
    };
  }
  if (cm.scheduledAt && !cm.completedAt) {
    return {
      label: "Зафіксувати результати заміру",
      tab: "measurement",
      disabled: false,
      disabledReason: null,
    };
  }
  if (cm.mismatchDetected && !cm.rollbackToEstimateRequested) {
    return {
      label: "Оформити перегляд прорахунку після розбіжностей",
      tab: "overview",
      disabled: false,
      disabledReason: null,
    };
  }

  if (!techDone) {
    return {
      label: "Заповнити технічний чеклист",
      tab: "overview",
      disabled: false,
      disabledReason: null,
    };
  }

  if (data.handoff.status === "DRAFT" || data.handoff.status === "REJECTED") {
    return {
      label:
        data.handoff.status === "REJECTED"
          ? "Оновити пакет передачі"
          : "Підготувати до виробництва",
      tab: "handoff",
      disabled: !data.readinessAllMet,
      disabledReason: data.readinessAllMet
        ? null
        : "Спочатку закрийте блокери готовності (див. бічну панель).",
    };
  }

  if (
    data.productionLaunch.status === "NOT_READY" ||
    data.productionLaunch.status === "FAILED"
  ) {
    return {
      label: "Передати у виробництво",
      tab: "handoff",
      disabled: !data.readinessAllMet,
      disabledReason: data.readinessAllMet
        ? null
        : "Немає повної готовності до передачі.",
    };
  }

  return {
    label: "Контролювати виконання",
    tab: "overview",
    disabled: false,
    disabledReason: null,
  };
}

export function contractStatusShortUa(
  s: DealContractStatus | null,
): string {
  if (!s) return "Немає договору";
  const m: Record<DealContractStatus, string> = {
    DRAFT: "Чернетка",
    GENERATED: "Згенеровано",
    EDITED: "Редакція",
    PENDING_INTERNAL_APPROVAL: "На погодженні",
    APPROVED_INTERNAL: "Погоджено",
    SENT_FOR_SIGNATURE: "На підписі",
    VIEWED_BY_CLIENT: "Переглянуто",
    CLIENT_SIGNED: "Підпис клієнта",
    COMPANY_SIGNED: "Підпис ENVER",
    FULLY_SIGNED: "Підписано",
    DECLINED: "Відхилено",
    EXPIRED: "Прострочено",
    SUPERSEDED: "Замінено",
  };
  return m[s];
}
