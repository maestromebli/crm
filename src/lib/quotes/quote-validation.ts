import type { QuoteImage, QuoteItem } from "./quote-types";

const MAX_ITEMS = 80;
const MAX_TITLE = 500;
const MAX_DESC_LINES = 120;
const MAX_LINE_LEN = 600;
const MAX_IMAGES = 12;

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object";
}

export function parseQuoteImage(raw: unknown): QuoteImage | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  const url = typeof raw.url === "string" && raw.url.trim() ? raw.url.trim() : "";
  if (!id || !url || url.length > 2048) return null;
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? Math.round(raw.sortOrder)
      : 0;
  const alt =
    typeof raw.alt === "string" ? raw.alt.trim().slice(0, 200) : undefined;
  return { id, url, sortOrder, ...(alt ? { alt } : {}) };
}

export function parseQuoteItem(raw: unknown, index: number): QuoteItem | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, MAX_TITLE)
      : "";
  if (!id || !title) return null;

  const quantity =
    typeof raw.quantity === "number" && Number.isFinite(raw.quantity) && raw.quantity > 0
      ? Math.min(9999, Math.round(raw.quantity * 1000) / 1000)
      : 1;

  let totalPrice = 0;
  if (typeof raw.totalPrice === "number" && Number.isFinite(raw.totalPrice)) {
    totalPrice = Math.round(raw.totalPrice * 100) / 100;
  }

  let unitPrice: number | undefined;
  if (typeof raw.unitPrice === "number" && Number.isFinite(raw.unitPrice)) {
    unitPrice = Math.round(raw.unitPrice * 100) / 100;
  }

  const descriptionLines: string[] = [];
  if (Array.isArray(raw.descriptionLines)) {
    for (const line of raw.descriptionLines) {
      if (typeof line !== "string") continue;
      const t = line.trim().slice(0, MAX_LINE_LEN);
      if (t) descriptionLines.push(t);
      if (descriptionLines.length >= MAX_DESC_LINES) break;
    }
  }

  const images: QuoteImage[] = [];
  if (Array.isArray(raw.images)) {
    for (const im of raw.images) {
      const pi = parseQuoteImage(im);
      if (pi) images.push(pi);
      if (images.length >= MAX_IMAGES) break;
    }
  }
  images.sort((a, b) => a.sortOrder - b.sortOrder);

  const notes =
    typeof raw.notes === "string" ? raw.notes.trim().slice(0, 2000) : undefined;

  return {
    id,
    sortOrder: index,
    title,
    quantity,
    totalPrice,
    ...(unitPrice !== undefined ? { unitPrice } : {}),
    descriptionLines,
    images,
    ...(notes ? { notes } : {}),
  };
}

export function parseQuoteItemsArray(raw: unknown): QuoteItem[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_ITEMS) return null;
  const out: QuoteItem[] = [];
  let i = 0;
  for (const row of raw) {
    const it = parseQuoteItem(row, i);
    if (it) {
      it.sortOrder = i;
      out.push(it);
      i++;
    }
  }
  return out;
}
