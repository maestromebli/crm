/** Сегменти з NAV_SECTIONS для списків (не є id контакту). */
export const CONTACTS_LIST_SEGMENTS = new Set([
  "clients",
  "partners",
  "repeat",
  "segments",
  "activity",
]);

export type ContactListView =
  | "all"
  | "clients"
  | "partners"
  | "repeat"
  | "segments"
  | "activity";

export type ContactsRouteParsed =
  | { kind: "list"; view: ContactListView }
  | { kind: "detail"; contactId: string; tab: string | null };

/**
 * /contacts → all
 * /contacts/clients → фільтр
 * /contacts/cmxxx → картка
 * /contacts/cmxxx/deals → вкладка
 */
export function parseContactsSlug(slug?: string[]): ContactsRouteParsed {
  if (!slug?.length) {
    return { kind: "list", view: "all" };
  }

  if (slug.length === 1 && CONTACTS_LIST_SEGMENTS.has(slug[0])) {
    return { kind: "list", view: slug[0] as ContactListView };
  }

  if (slug.length === 1) {
    return { kind: "detail", contactId: slug[0], tab: null };
  }

  return { kind: "detail", contactId: slug[0], tab: slug[1] ?? null };
}

export const CONTACT_DETAIL_TABS = new Set([
  "deals",
  "conversations",
  "files",
  "tasks",
  "activity",
]);
