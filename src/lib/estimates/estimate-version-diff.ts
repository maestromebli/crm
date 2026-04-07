import type { EstimateCategoryKey } from "./estimate-categories";

/** Знімок рядка для порівняння версій */
export type SnapshotLine = {
  key: string;
  categoryKey: EstimateCategoryKey;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  amountSale: number;
  supplierProvider?: string | null;
  supplierMaterialName?: string | null;
};

export type DiffRow =
  | {
      kind: "added";
      line: SnapshotLine;
    }
  | {
      kind: "changed";
      baseline: SnapshotLine;
      preview: SnapshotLine;
    }
  | {
      kind: "unchanged";
      line: SnapshotLine;
    };

function lineSig(l: SnapshotLine) {
  return `${l.categoryKey}|${l.productName.trim().toLowerCase()}`;
}

/**
 * Порівнює збережену базу та чернетку нової версії.
 */
export function computeEstimateLineDiff(
  baseline: SnapshotLine[],
  preview: SnapshotLine[],
): {
  byKeyBaseline: Map<string, SnapshotLine>;
  byKeyPreview: Map<string, SnapshotLine>;
  diffRows: DiffRow[];
  removed: SnapshotLine[];
  summaryLines: string[];
} {
  const byKeyBaseline = new Map(baseline.map((l) => [l.key, l]));
  const byKeyPreview = new Map(preview.map((l) => [l.key, l]));

  const removed: SnapshotLine[] = [];
  for (const b of baseline) {
    if (!byKeyPreview.has(b.key)) removed.push(b);
  }

  const diffRows: DiffRow[] = [];
  const seenSig = new Set<string>();

  for (const p of preview) {
    const b = byKeyBaseline.get(p.key);
    if (!b) {
      diffRows.push({ kind: "added", line: p });
      seenSig.add(lineSig(p));
      continue;
    }
    const changed =
      Math.abs(b.amountSale - p.amountSale) > 0.5 ||
      Math.abs(b.qty - p.qty) > 0.0001 ||
      Math.abs(b.salePrice - p.salePrice) > 0.01 ||
      b.productName.trim() !== p.productName.trim();
    if (changed) {
      diffRows.push({ kind: "changed", baseline: b, preview: p });
    } else {
      diffRows.push({ kind: "unchanged", line: p });
    }
  }

  const summaryLines: string[] = [];
  for (const r of diffRows) {
    if (r.kind === "added") {
      summaryLines.push(`Додано: ${r.line.productName}`);
    } else if (r.kind === "changed") {
      summaryLines.push(
        `Оновлено: ${r.preview.productName} (${r.baseline.amountSale.toLocaleString("uk-UA")} → ${r.preview.amountSale.toLocaleString("uk-UA")} грн)`,
      );
    }
  }
  for (const r of removed) {
    summaryLines.push(`Видалено з нової версії: ${r.productName}`);
  }

  return {
    byKeyBaseline,
    byKeyPreview,
    diffRows,
    removed,
    summaryLines,
  };
}
