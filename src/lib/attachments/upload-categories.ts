import type { AttachmentCategory } from "@prisma/client";

/** Категорії, дозволені при ручному завантаженні вкладень (угода / лід). */
export const ATTACHMENT_UPLOAD_CATEGORIES: AttachmentCategory[] = [
  "OBJECT_PHOTO",
  "MEASUREMENT_SHEET",
  "BRIEF",
  "REFERENCE",
  "CALCULATION",
  "QUOTE_PDF",
  "CONTRACT",
  "INVOICE",
  "PAYMENT_CONFIRMATION",
  "DRAWING",
  "SPEC",
  "TECH_CARD",
  "INSTALL_SCHEME",
  "ACCEPTANCE_ACT",
  "RESULT_PHOTO",
  "OTHER",
];

export function isAttachmentUploadCategory(
  v: string,
): v is AttachmentCategory {
  return ATTACHMENT_UPLOAD_CATEGORIES.includes(v as AttachmentCategory);
}
