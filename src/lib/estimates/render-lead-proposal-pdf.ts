import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { QuotePrintModel } from "../leads/lead-proposal-document";

export type LeadProposalPdfInput = {
  leadTitle: string;
  proposalTitle: string | null;
  proposalVersion: number;
  estimateVersion: number | null;
  total: number | null;
  currency: string;
  lines: Array<{ name: string; qty: number; unit: string; amount: number }>;
  summary: string | null;
};

const NOTO_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.2.5/files/noto-sans-cyrillic-400-normal.ttf";

async function loadUnicodeFont(doc: PDFDocument) {
  try {
    const res = await fetch(NOTO_URL);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    return doc.embedFont(bytes);
  } catch {
    return null;
  }
}

/**
 * Генерує PDF КП (компактний, без ERP-верстки).
 */
export async function renderLeadProposalPdf(
  input: LeadProposalPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontUni = await loadUnicodeFont(doc);
  const font = fontUni ?? (await doc.embedFont(StandardFonts.Helvetica));
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - 48;
  const margin = 48;
  const lineH = fontUni ? 14 : 12;
  const text = (s: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    page.drawText(s, {
      x: margin,
      y,
      size,
      font: f,
      color: rgb(0.1, 0.12, 0.15),
      maxWidth: width - margin * 2,
    });
    y -= size + 6;
  };

  text("Комерційна пропозиція", 16, true);
  text(input.proposalTitle || input.leadTitle, 12);
  y -= 4;
  text(`Версія КП: ${input.proposalVersion}`, 10);
  if (input.estimateVersion != null) {
    text(`База: смета v${input.estimateVersion}`, 10);
  }
  y -= 8;

  if (input.total != null) {
    text(
      `Всього: ${input.total.toLocaleString("uk-UA")} ${input.currency}`,
      14,
      true,
    );
    y -= 4;
  }

  y -= 8;
  text("Позиції", 11, true);
  for (const row of input.lines.slice(0, 40)) {
    if (y < margin + 60) break;
    const line = `${row.name} — ${row.qty} ${row.unit} — ${row.amount.toLocaleString("uk-UA")}`;
    page.drawText(line.slice(0, 120), {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.2, 0.22, 0.25),
      maxWidth: width - margin * 2,
    });
    y -= lineH;
  }

  if (input.summary?.trim()) {
    y -= 6;
    text("Умови / коментар", 10, true);
    const parts = input.summary.trim().split(/\n+/).slice(0, 15);
    for (const p of parts) {
      if (y < margin) break;
      page.drawText(p.slice(0, 200), {
        x: margin,
        y,
        size: 9,
        font,
        color: rgb(0.25, 0.27, 0.3),
        maxWidth: width - margin * 2,
      });
      y -= lineH;
    }
  }

  page.drawText("Документ згенеровано в ENVER CRM", {
    x: margin,
    y: margin - 20,
    size: 8,
    font,
    color: rgb(0.5, 0.52, 0.55),
  });

  return doc.save();
}

/**
 * PDF з повної моделі друку КП (груповані позиції з `buildQuotePrintModelFromEntities`).
 */
export async function renderLeadProposalPdfFromModel(
  model: QuotePrintModel,
): Promise<Uint8Array> {
  const lines = model.rows.map((r) => ({
    name: r.title,
    qty: r.quantity,
    unit: "шт",
    amount: r.lineTotal,
  }));
  return renderLeadProposalPdf({
    leadTitle: model.objectLine || model.docTitle,
    proposalTitle: model.docTitle,
    proposalVersion: model.proposalVersion,
    estimateVersion: model.estimateVersion,
    total: model.totals.total,
    currency: model.currencyLabel || "грн",
    lines,
    summary: model.summary,
  });
}
