import type { LeadDetailRow } from "../../features/leads/queries";
import {
  computeLeadReadiness,
  mapLeadDetailRowToCoreInput,
} from "../crm-core";
import { validateLeadConversionToDeal } from "../crm-core";

/** Три стани для чеклисту готовності (продаж). */
export type ReadinessRowState = "ready" | "partial" | "missing";

export type LeadReadinessRow = {
  key: string;
  label: string;
  state: ReadinessRowState;
  /** Коротка підказка під рядком */
  hint?: string;
};

/**
 * Рядки готовності для Hub / модалки — джерело істини: `crm-core`.
 */
export function computeLeadReadinessRows(lead: LeadDetailRow): LeadReadinessRow[] {
  const input = mapLeadDetailRowToCoreInput(lead);
  const r = computeLeadReadiness(input);
  return r.items.map((it) => ({
    key: it.key,
    label: it.labelUa,
    state: it.state,
    hint: it.hintUa ?? undefined,
  }));
}

/** Банер у модалці конвертації (серверні правила через conversion gate). */
export type ConvertReadinessBanner = {
  variant: "ready" | "warn" | "attention";
  title: string;
  subtitle: string;
};

export function deriveConvertReadinessBanner(
  lead: LeadDetailRow,
): ConvertReadinessBanner {
  const input = mapLeadDetailRowToCoreInput(lead);
  const gate = validateLeadConversionToDeal(input);
  if (!gate.ok) {
    return {
      variant: "attention",
      title: "Умови конверсії не виконані",
      subtitle: gate.errors.map((e) => e.messageUa).join(" · "),
    };
  }
  if (gate.warnings.length > 0) {
    return {
      variant: "warn",
      title: "Можна створити замовлення з зауваженнями",
      subtitle: gate.warnings.map((w) => w.messageUa).join(" · "),
    };
  }
  return {
    variant: "ready",
    title: "Готово до конверсії",
    subtitle:
      "Перевірте перенос файлів і комерції — далі замовлення отримає стабільні знімки.",
  };
}

/** Одна рядкова рекомендація під чеклистом. */
export function deriveLeadReadinessRecommendation(
  rows: LeadReadinessRow[],
): string {
  const missing = rows.filter((r) => r.state === "missing");
  const partial = rows.filter((r) => r.state === "partial");
  if (missing.length > 0) {
    const m = missing[0];
    return m.hint
      ? `${m.label}: ${m.hint}`
      : `Спочатку: ${m.label.toLowerCase()}`;
  }
  if (partial.length > 0) {
    const p = partial[0];
    return p.hint
      ? `${p.label}: ${p.hint}`
      : `Уточніть: ${p.label.toLowerCase()}`;
  }
  return "Рухайтесь до КП та фіксуйте кожен дотик у стрічці.";
}
