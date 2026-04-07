"use client";

/** Мінімум полів ліда для перевірки наступного кроку. */
export type LeadWithNextStep = {
  nextStep?: string | null;
  /** ISO `YYYY-MM-DD` з API (або з власного мапінгу). */
  nextStepDate?: string | null;
  nextContactAt?: Date | string | null;
};

function hasScheduledContact(lead: LeadWithNextStep | null | undefined) {
  if (lead?.nextStepDate?.trim()) return true;
  if (lead?.nextContactAt == null) return false;
  const t = new Date(lead.nextContactAt as string | Date).getTime();
  return !Number.isNaN(t);
}

export function useNextStep(lead: LeadWithNextStep | null | undefined) {
  const trimmed = lead?.nextStep?.trim() ?? "";
  const hasNextStep = trimmed.length > 0;
  const hasNextStepDate = hasScheduledContact(lead);

  return {
    hasNextStep,
    hasNextStepDate,
    /** Як у KPI «немає наступного кроку»: немає тексту кроку і немає дати контакту. */
    isProblem: !hasNextStep && !hasNextStepDate,
  };
}
