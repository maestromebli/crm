import type { ProductionStepKey, ProductionStepState } from "../../types/production";

export const PRODUCTION_STEP_SEQUENCE: ProductionStepKey[] = [
  "ACCEPTED_BY_CHIEF",
  "CONSTRUCTOR_ASSIGNED",
  "CONSTRUCTOR_IN_PROGRESS",
  "FILES_PACKAGE_UPLOADED",
  "FILES_VALIDATED",
  "APPROVED_BY_CHIEF",
  "TASKS_DISTRIBUTED",
];

export function getStepLabel(step: ProductionStepKey): string {
  switch (step) {
    case "ACCEPTED_BY_CHIEF":
      return "Прийнято начальником виробництва";
    case "CONSTRUCTOR_ASSIGNED":
      return "Призначено конструктора";
    case "CONSTRUCTOR_IN_PROGRESS":
      return "Конструктор опрацьовує";
    case "FILES_PACKAGE_UPLOADED":
      return "Пакет файлів зареєстровано";
    case "FILES_VALIDATED":
      return "Пакет перевірено";
    case "APPROVED_BY_CHIEF":
      return "Апрув начальником виробництва";
    case "TASKS_DISTRIBUTED":
      return "Розподіл у закупівлю та виробництво";
    default:
      return step;
  }
}

export function computeStepStates(
  currentStepKey: ProductionStepKey,
  blockedSteps: ProductionStepKey[] = [],
): Array<{ key: ProductionStepKey; label: string; state: ProductionStepState }> {
  const currentIndex = PRODUCTION_STEP_SEQUENCE.indexOf(currentStepKey);
  return PRODUCTION_STEP_SEQUENCE.map((key, index) => {
    if (blockedSteps.includes(key)) return { key, label: getStepLabel(key), state: "BLOCKED" };
    if (index < currentIndex) return { key, label: getStepLabel(key), state: "DONE" };
    if (index === currentIndex) return { key, label: getStepLabel(key), state: "IN_PROGRESS" };
    if (index === currentIndex + 1) return { key, label: getStepLabel(key), state: "AVAILABLE" };
    return { key, label: getStepLabel(key), state: "LOCKED" };
  });
}
