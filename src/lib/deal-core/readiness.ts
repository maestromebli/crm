import type { DealContractStatus } from "@prisma/client";
import type { DealWorkspaceMeta, ReadinessCheck } from "./workspace-types";
import type { EffectivePaymentMilestone } from "./payment-aggregate";
import type { DealControlMeasurementV1 } from "../deals/control-measurement";

function contractSigned(status: DealContractStatus | null): boolean {
  return status === "FULLY_SIGNED";
}

function hasPaymentDone(
  meta: DealWorkspaceMeta,
  effectiveMilestones?: EffectivePaymentMilestone[],
): boolean {
  const src = effectiveMilestones;
  if (src && src.length > 0) {
    return src.some((x) => x.done);
  }
  const m = meta.payment?.milestones ?? [];
  if (m.length === 0) return false;
  return m.some((x) => x.done);
}

function technicalChecklistComplete(
  meta: DealWorkspaceMeta,
): { done: boolean; missingLabels: string[] } {
  const t = meta.technicalChecklist;
  /** Доки менеджер не відкрив структурований чеклист — не блокуємо legacy-угоди. */
  if (t === undefined) {
    return { done: true, missingLabels: [] };
  }
  const items: Array<{ key: keyof NonNullable<typeof t>; label: string }> = [
    { key: "finalDimensionsConfirmed", label: "Фінальні розміри підтверджено" },
    { key: "materialsConfirmed", label: "Матеріали підтверджено" },
    { key: "fittingsConfirmed", label: "Фурнітура підтверджено" },
    { key: "drawingsAttached", label: "Креслення додано" },
    { key: "clientApprovalsConfirmed", label: "Погодження клієнта зафіксовано" },
    { key: "specialNotesDocumented", label: "Особливі нотатки задокументовано" },
  ];
  const missing = items
    .filter((i) => !t[i.key])
    .map((i) => i.label);
  return {
    done: missing.length === 0,
    missingLabels: missing,
  };
}

export function evaluateReadiness(input: {
  meta: DealWorkspaceMeta;
  contractStatus: DealContractStatus | null;
  attachmentsByCategory: Record<string, number>;
  effectivePaymentMilestones?: EffectivePaymentMilestone[];
  controlMeasurement?: DealControlMeasurementV1 | null;
}): ReadinessCheck[] {
  const {
    meta,
    contractStatus,
    attachmentsByCategory,
    effectivePaymentMilestones,
    controlMeasurement,
  } = input;
  const checks: ReadinessCheck[] = [];

  checks.push({
    id: "contract_signed",
    label: "Договір повністю підписано",
    done: contractSigned(contractStatus),
    source: "DealContract.status",
    blockerMessage: contractSigned(contractStatus)
      ? undefined
      : "Завершіть підписання договору (клієнт + компанія).",
  });

  checks.push({
    id: "prepayment",
    label: "Передоплата / платіж за політикою підтверджено",
    done: hasPaymentDone(meta, effectivePaymentMilestones),
    source: "DealPaymentMilestone | workspaceMeta.payment",
    blockerMessage: hasPaymentDone(meta, effectivePaymentMilestones)
      ? undefined
      : "Зафіксуйте підтвердження оплати на вкладці «Оплата».",
  });

  const measurementDone =
    Boolean(meta.measurementComplete) ||
    Boolean(controlMeasurement?.completedAt);
  checks.push({
    id: "measurement",
    label: "Дані заміру зафіксовані",
    done: measurementDone,
    source: "workspaceMeta.measurementComplete | controlMeasurement",
    blockerMessage: measurementDone
      ? undefined
      : "Заповніть результати заміру.",
  });

  const hasDrawing =
    (attachmentsByCategory.DRAWING ?? 0) > 0 ||
    (attachmentsByCategory.MEASUREMENT_SHEET ?? 0) > 0;
  checks.push({
    id: "technical_files",
    label: "Є креслення або лист заміру",
    done: hasDrawing,
    source: "Attachment.category",
    blockerMessage: hasDrawing
      ? undefined
      : "Додайте файли на вкладці «Файли».",
  });

  checks.push({
    id: "handoff_package",
    label: "Пакет передачі зібрано",
    done: Boolean(meta.handoffPackageReady),
    source: "workspaceMeta.handoffPackageReady",
    blockerMessage: meta.handoffPackageReady
      ? undefined
      : "Підготуйте пакет на вкладці «Передача».",
  });

  const tech = technicalChecklistComplete(meta);
  checks.push({
    id: "technical_checklist",
    label: "Технічний чеклист для виробництва",
    done: tech.done,
    source: "workspaceMeta.technicalChecklist",
    blockerMessage: tech.done
      ? undefined
      : tech.missingLabels.join(" · "),
  });

  return checks;
}

export function allReadinessMet(checks: ReadinessCheck[]): boolean {
  return checks.length > 0 && checks.every((c) => c.done);
}
