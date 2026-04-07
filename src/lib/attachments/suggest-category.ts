import type { AttachmentCategory } from "@prisma/client";

/**
 * Легка евристика для Lead Hub після завантаження (без ML).
 */
export function suggestAttachmentCategoryFromFile(
  fileName: string,
  mimeType: string,
): AttachmentCategory {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (mime.startsWith("image/")) {
    if (/скан|scan|document|doc|паспорт|passport/.test(name)) {
      return "OTHER";
    }
    return "OBJECT_PHOTO";
  }

  if (mime.includes("pdf")) {
    if (
      /кп|quote|estimate|прорахунок|рахунок|invoice|договір|contract/.test(name)
    ) {
      return "QUOTE_PDF";
    }
    if (/замір|measure|plan|кресл|drawing/.test(name)) {
      return "MEASUREMENT_SHEET";
    }
    return "OTHER";
  }

  if (/замір|measure|xls|xlsx|csv/.test(name) || mime.includes("sheet")) {
    return "MEASUREMENT_SHEET";
  }

  if (/референс|reference|mood|inspo/.test(name)) {
    return "REFERENCE";
  }

  if (/розрах|calc|estimate/.test(name)) {
    return "CALCULATION";
  }

  return "OTHER";
}
