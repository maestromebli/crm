import type { AttachmentCategory } from "@prisma/client";

/** Вітрина Lead Hub за продуктовими кошиками ENVER (узгоджено з CRM Core). */
export type LeadHubProductBucketId =
  | "PROJECT"
  | "PHOTOS"
  | "MEASUREMENTS"
  | "ESTIMATES"
  | "QUOTES"
  | "CONTRACTS"
  | "TECHNICAL"
  | "OTHER";

export const LEAD_HUB_PRODUCT_BUCKETS: {
  id: LeadHubProductBucketId;
  labelUa: string;
  categories: AttachmentCategory[];
}[] = [
  {
    id: "PROJECT",
    labelUa: "Проєкт / бриф",
    categories: ["BRIEF", "REFERENCE"],
  },
  {
    id: "PHOTOS",
    labelUa: "Фото об’єкта",
    categories: ["OBJECT_PHOTO", "RESULT_PHOTO"],
  },
  {
    id: "MEASUREMENTS",
    labelUa: "Заміри",
    categories: ["MEASUREMENT_SHEET"],
  },
  {
    id: "ESTIMATES",
    labelUa: "Розрахунки",
    categories: ["CALCULATION"],
  },
  {
    id: "QUOTES",
    labelUa: "КП / комерційні PDF",
    categories: ["QUOTE_PDF"],
  },
  {
    id: "CONTRACTS",
    labelUa: "Договори / оплата",
    categories: [
      "CONTRACT",
      "INVOICE",
      "PAYMENT_CONFIRMATION",
      "ACCEPTANCE_ACT",
    ],
  },
  {
    id: "TECHNICAL",
    labelUa: "Технічні",
    categories: ["DRAWING", "SPEC", "TECH_CARD", "INSTALL_SCHEME"],
  },
  { id: "OTHER", labelUa: "Інше", categories: ["OTHER"] },
];

export function productBucketForCategory(
  category: AttachmentCategory,
): LeadHubProductBucketId {
  for (const b of LEAD_HUB_PRODUCT_BUCKETS) {
    if (b.categories.includes(category)) return b.id;
  }
  return "OTHER";
}

export type LeadHubFileGroupId =
  | "client_photos"
  | "measurements"
  | "inspiration"
  | "estimate"
  | "technical"
  | "documents"
  | "misc";

export const LEAD_HUB_FILE_GROUPS: {
  id: LeadHubFileGroupId;
  label: string;
  categories: AttachmentCategory[];
}[] = [
  {
    id: "client_photos",
    label: "Фото від клієнта",
    categories: ["OBJECT_PHOTO", "RESULT_PHOTO"],
  },
  {
    id: "measurements",
    label: "Заміри приміщення",
    categories: ["MEASUREMENT_SHEET"],
  },
  {
    id: "inspiration",
    label: "Референси / натхнення",
    categories: ["REFERENCE", "BRIEF"],
  },
  {
    id: "estimate",
    label: "До прорахунку / КП",
    categories: ["CALCULATION", "QUOTE_PDF"],
  },
  {
    id: "technical",
    label: "Технічні",
    categories: ["DRAWING", "SPEC", "TECH_CARD", "INSTALL_SCHEME"],
  },
  {
    id: "documents",
    label: "Документи",
    categories: [
      "CONTRACT",
      "INVOICE",
      "PAYMENT_CONFIRMATION",
      "ACCEPTANCE_ACT",
    ],
  },
  {
    id: "misc",
    label: "Інше",
    categories: ["OTHER"],
  },
];

export function groupIdForCategory(
  category: AttachmentCategory,
): LeadHubFileGroupId {
  for (const g of LEAD_HUB_FILE_GROUPS) {
    if (g.categories.includes(category)) return g.id;
  }
  return "misc";
}
