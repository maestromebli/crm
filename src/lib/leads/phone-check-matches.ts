/** Елемент `matches` у відповіді `GET /api/leads/check-phone`. */
export type PhoneDuplicateMatchType = "lead" | "contact" | "deal";

export type PhoneDuplicateMatch = {
  type: PhoneDuplicateMatchType;
  /** Для посилань у UI. */
  id: string;
  /** Підпис: лід/контакт — назва; замовлення — імʼя контакту або назва замовлення. */
  name: string;
  /** Сума замовлення; для ліда та контакту завжди `null`. */
  value: number | null;
  /** Валюта замовлення (якщо є). */
  currency?: string | null;
};
