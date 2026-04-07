/** Елемент `matches` у відповіді `GET /api/leads/check-phone`. */
export type PhoneDuplicateMatchType = "lead" | "contact" | "deal";

export type PhoneDuplicateMatch = {
  type: PhoneDuplicateMatchType;
  /** Для посилань у UI. */
  id: string;
  /** Підпис: лід/контакт — назва; угода — імʼя контакту або назва угоди. */
  name: string;
  /** Сума угоди; для ліда та контакту завжди `null`. */
  value: number | null;
  /** Валюта угоди (якщо є). */
  currency?: string | null;
};
