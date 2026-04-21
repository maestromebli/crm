import type { AiDetectedFileCategory } from "@prisma/client";

export type TextExtractResult = {
  text: string | null;
  mode: "text" | "pdf" | "image" | "spreadsheet" | "binary" | "unsupported";
};

const MAX_TEXT = 48_000;

/**
 * Витягує текст із буфера файлу (PDF, plain text, xlsx як CSV-подібний рядок — спрощено).
 */
export async function extractTextFromBuffer(args: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<TextExtractResult> {
  const mime = args.mimeType.toLowerCase();
  const name = args.fileName.toLowerCase();

  if (mime.startsWith("text/") || mime === "application/csv") {
    const text = args.buffer.toString("utf8").trim().slice(0, MAX_TEXT);
    return { text: text.length > 0 ? text : null, mode: "text" };
  }

  if (mime === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: args.buffer });
      const data = await parser.getText();
      const text = (data.text ?? "").trim().slice(0, MAX_TEXT);
      return { text: text.length > 2 ? text : null, mode: "pdf" };
    } catch {
      return { text: null, mode: "pdf" };
    }
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(args.buffer, { type: "buffer" });
      const first = wb.SheetNames[0];
      if (!first) return { text: null, mode: "spreadsheet" };
      const sheet = wb.Sheets[first];
      const csv = XLSX.utils.sheet_to_csv(sheet).slice(0, MAX_TEXT);
      const text = csv.trim();
      return { text: text.length > 0 ? text : null, mode: "spreadsheet" };
    } catch {
      return { text: null, mode: "spreadsheet" };
    }
  }

  if (mime.startsWith("image/")) {
    return { text: null, mode: "image" };
  }

  return { text: null, mode: "binary" };
}

export function guessCategoryFromSignals(input: {
  mimeType: string;
  fileName: string;
  attachmentCategory?: string | null;
  textSample: string | null;
}): AiDetectedFileCategory {
  const m = input.mimeType.toLowerCase();
  const n = input.fileName.toLowerCase();
  const t = (input.textSample ?? "").toLowerCase();
  const ac = (input.attachmentCategory ?? "").toUpperCase();

  if (m.startsWith("image/")) {
    if (/замір|measure|розмір|dim/i.test(n + t)) return "MEASUREMENT";
    if (/скрін|screenshot|telegram|viber|messenger/i.test(n + t))
      return "MESSENGER_SCREENSHOT";
    if (/віз|render|візуал|3d/i.test(n + t)) return "VISUALIZATION";
    return "PHOTO";
  }

  if (ac.includes("QUOTE") || /кп\.|комерц|proposal|offer/i.test(n + t))
    return "COMMERCIAL_PROPOSAL";
  if (ac.includes("CONTRACT") || /догов|contract/i.test(n + t))
    return "CONTRACT";
  if (ac.includes("INVOICE") || /рахунок|invoice|накладн/i.test(n + t))
    return "INVOICE";
  if (
    ac.includes("MEASUREMENT") ||
    ac.includes("DRAWING") ||
    /кресл|план|розміри|мм|схем/i.test(n + t)
  )
    return "MEASUREMENT";
  if (ac.includes("CALCULATION") || /смет|розрахунок|estimate/i.test(n + t))
    return "PROJECT";
  if (/техніч|специфікац|spec|tz|тз/i.test(n + t)) return "TECHNICAL";

  if (m === "application/pdf" || n.endsWith(".docx") || n.endsWith(".doc")) {
    if (/догов|замовлень|contract/i.test(t)) return "CONTRACT";
    if (/кп|пропозиці|комерц/i.test(t)) return "COMMERCIAL_PROPOSAL";
    if (/рахунок|до сплати|invoice/i.test(t)) return "INVOICE";
    if (/розмір|замір|план|кімнат/i.test(t)) return "DIMENSIONS";
    return "PROJECT";
  }

  return "OTHER";
}
