/** Сегменти з NAV_SECTIONS для списків (не є id ліда). */
export const LEADS_LIST_SEGMENTS = new Set([
  "new",
  "no-response",
  "no-next-step",
  "mine",
  "overdue",
  "duplicates",
  "re-contact",
  "converted",
  "unassigned",
  "qualified",
  "closed",
  "lost",
  "archived",
  "sources",
  "pipeline",
]);

export type LeadsRouteParsed =
  | { kind: "list"; view: string }
  | { kind: "detail"; leadId: string; tab: string | null };

/**
 * /leads → all
 * /leads/new → list (фільтр)
 * /leads/clxxx → картка
 * /leads/clxxx/contact → вкладка
 */
export function parseLeadsSlug(slug?: string[]): LeadsRouteParsed {
  if (!slug?.length) {
    return { kind: "list", view: "all" };
  }

  if (slug.length === 1 && LEADS_LIST_SEGMENTS.has(slug[0])) {
    return { kind: "list", view: slug[0] };
  }

  if (slug.length === 1) {
    return { kind: "detail", leadId: slug[0], tab: null };
  }

  if (slug.length >= 2) {
    return { kind: "detail", leadId: slug[0], tab: slug[1] };
  }

  return { kind: "list", view: "all" };
}
