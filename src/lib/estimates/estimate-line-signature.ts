/** Спільний ключ для порівняння / політики версій (агрегація однакових рядків). */

export type LineForSignature = {
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  amountSale: number;
};

function normalizeTitle(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export function lineSignature(li: LineForSignature): string {
  const cat = (li.category ?? "").trim();
  const title = normalizeTitle(li.productName);
  const u = li.unit.trim() || "шт";
  return `${cat}|${title}|${li.qty}|${u}`;
}

export function aggregateAmountBySignature(
  lines: LineForSignature[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const li of lines) {
    const sig = lineSignature(li);
    m.set(sig, (m.get(sig) ?? 0) + li.amountSale);
  }
  return m;
}
