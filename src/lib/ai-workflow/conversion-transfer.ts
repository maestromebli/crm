import type { LeadDetailRow } from "../../features/leads/queries";
import type { ConversionTransferSuggestion } from "./types";

/**
 * Рекомендації для модалки конверсії (§7.1) — евристики без LLM.
 */
export function deriveConversionTransferSuggestion(
  lead: LeadDetailRow,
): ConversionTransferSuggestion {
  const est = lead.estimates[0];
  const prop = lead.proposals[0];

  const recommendedFileIds = lead.attachments
    .filter((a) =>
      ["MEASUREMENT_SHEET", "DRAWING", "OBJECT_PHOTO", "REFERENCE"].includes(
        a.category,
      ),
    )
    .map((a) => a.id);

  const excludedFileIds: string[] = [];

  const reasonParts: string[] = [];
  if (est) {
    reasonParts.push(`Актуальна смета: v${est.version}.`);
  }
  if (prop) {
    reasonParts.push(`КП v${prop.version} для передачі контексту.`);
  }
  if (recommendedFileIds.length > 0) {
    reasonParts.push("Додайте креслення / фото обʼєкта до угоди.");
  }
  reasonParts.push("Повна історія листування зазвичай надлишкова — достатньо останніх подій.");

  return {
    recommendedFileIds,
    excludedFileIds,
    recommendedEstimateId: est?.id,
    recommendedProposalId: prop?.id,
    includeCommunication: false,
    reasonSummary: reasonParts.join(" "),
  };
}

/**
 * Чернетка handoff-тексту для угоди (§7.2) — короткі рядки.
 */
export function deriveConversionHandoffSummaryLines(
  lead: LeadDetailRow,
): string[] {
  const est = lead.estimates[0];
  const prop = lead.proposals[0];
  const lines: string[] = [];
  if (est && prop) {
    lines.push(
      `Узгоджено КП v${prop.version} на базі смети v${est.version}.`,
    );
  } else if (est) {
    lines.push(
      `Є смета v${est.version} (${est.status}) — узгодьте КП перед виробництвом.`,
    );
  }
  const q = lead.qualification;
  if (q.budgetRange?.trim()) {
    lines.push(`Орієнтир бюджету: ${q.budgetRange.trim()}.`);
  }
  if (q.timeline?.trim()) {
    lines.push(`Очікування по термінах: ${q.timeline.trim()}.`);
  }
  lines.push(
    "Перевірте перенесення файлів заміру та креслень у пакет угоди.",
  );
  lines.push("Наступний крок у виконанні: договір та передоплата за шаблоном компанії.");
  return lines.slice(0, 5);
}
