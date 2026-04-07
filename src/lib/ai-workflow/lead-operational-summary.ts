import type { LeadDetailRow } from "../../features/leads/queries";

/**
 * 2–4 короткі рядки контексту без LLM (§3.1) — для чипа / картки в Hub.
 */
export function deriveOperationalLeadSummaryLines(
  lead: LeadDetailRow,
): string[] {
  const lines: string[] = [];
  const q = lead.qualification;
  const want =
    q.furnitureType?.trim() ||
    q.objectType?.trim() ||
    lead.title ||
    "запит клієнта";
  lines.push(`Запит: ${want}.`);
  lines.push(`Стадія: ${lead.stage.name}.`);

  const est = lead.estimates[0];
  const prop = lead.proposals[0];
  if (!est) {
    lines.push("Комерція: смети ще немає.");
  } else if (!prop) {
    lines.push(`Є смета v${est.version} (${est.status}), КП не створено.`);
  } else {
    lines.push(
      `Комерція: смета v${est.version}, КП v${prop.version} — ${prop.status}.`,
    );
  }

  if (lead.nextStep?.trim()) {
    const d = lead.nextContactAt
      ? ` До ${lead.nextContactAt.toLocaleDateString("uk-UA")}.`
      : "";
    lines.push(`Наступний крок: ${lead.nextStep.trim()}.${d}`);
  } else {
    lines.push("Наступний крок: не задано — варто запланувати контакт.");
  }

  return lines.slice(0, 4);
}
