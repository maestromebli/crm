import { PDFDocument, rgb } from "pdf-lib";

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

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, key: string) => {
    return (vars[key] ?? "").trim();
  });
}

export async function renderDealContractPdf(input: {
  title: string;
  contentHtml: string;
  variables: Record<string, string>;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await loadUnicodeFont(doc);
  if (!font) throw new Error("PDF_FONT_UNAVAILABLE");

  const PAGE_W = 595;
  const PAGE_H = 842;
  const M = 42;
  const lineH = 14;
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const drawLine = (text: string, size = 10, color = rgb(0.12, 0.14, 0.18)) => {
    if (y < 60) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
    }
    page.drawText(text, {
      x: M,
      y,
      size,
      font,
      color,
      maxWidth: PAGE_W - M * 2,
      lineHeight: lineH,
    });
    y -= lineH;
  };

  drawLine(input.title, 14, rgb(0.05, 0.08, 0.1));
  y -= 8;
  const fullText = stripHtml(applyVars(input.contentHtml, input.variables));
  const chunks = fullText.match(/.{1,95}(\s|$)/g) ?? [fullText];
  for (const c of chunks) {
    drawLine(c.trim(), 10);
  }
  return doc.save();
}
