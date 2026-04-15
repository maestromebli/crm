import type { ContactCategory } from "@prisma/client";

export const CONTACT_CATEGORY_LABEL: Record<ContactCategory, string> = {
  DESIGNER: "Дизайнер",
  CONSTRUCTION_COMPANY: "Будівельна компанія",
  MANAGER: "Менеджер",
  DESIGN_STUDIO: "Дизайн-студія",
  END_CUSTOMER: "Кінцевий споживач",
  ARCHITECT: "Архітектор",
  SUPPLIER: "Постачальник",
  OTHER: "Інше",
};

export const CONTACT_CATEGORY_OPTIONS: Array<{
  value: ContactCategory;
  label: string;
}> = (Object.keys(CONTACT_CATEGORY_LABEL) as ContactCategory[]).map((key) => ({
  value: key,
  label: CONTACT_CATEGORY_LABEL[key],
}));

