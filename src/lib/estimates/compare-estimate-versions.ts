/**
 * Compare two persisted estimate versions (different line item ids).
 * Pairs by metadata.baseItemId → lineage, then greedy semantic key.
 */
export type VersionMeta = {
  id: string;
  versionNumber: number;
  total: number | null;
  createdAt: string;
};

export type DiffAddedItem = {
  title: string;
  category: string | null;
  qty: number;
  unitPrice: number;
  totalPrice: number;
};

export type DiffRemovedItem = {
  title: string;
  category: string | null;
  qty: number;
  unitPrice: number;
  totalPrice: number;
};

export type DiffChangedItem = {
  title: string;
  category: string | null;
  fields: Array<{
    field: string;
    from: string;
    to: string;
  }>;
};

export type CompareEstimateVersionsResult = {
  fromVersion: VersionMeta;
  toVersion: VersionMeta;
  summary: {
    added: number;
    removed: number;
    changed: number;
    totalDelta: number;
  };
  addedItems: DiffAddedItem[];
  removedItems: DiffRemovedItem[];
  changedItems: DiffChangedItem[];
};

type Line = {
  id: string;
  category: string | null;
  productName: string;
  qty: number;
  salePrice: number;
  amountSale: number;
  metadataJson?: unknown;
};

function parseBaseItemId(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const b = (meta as Record<string, unknown>).baseItemId;
  return typeof b === "string" && b.trim() ? b.trim() : null;
}

function normKey(category: string | null, productName: string) {
  return `${(category ?? "").trim().toLowerCase()}|${productName.trim().toLowerCase()}`;
}

function fmtNum(n: number) {
  return n.toLocaleString("uk-UA") + " грн";
}

export function compareEstimateVersions(
  from: {
    id: string;
    version: number;
    totalPrice: number | null;
    createdAt: Date;
    lineItems: Line[];
  },
  to: {
    id: string;
    version: number;
    totalPrice: number | null;
    createdAt: Date;
    lineItems: Line[];
  },
): CompareEstimateVersionsResult {
  const fromMeta: VersionMeta = {
    id: from.id,
    versionNumber: from.version,
    total: from.totalPrice,
    createdAt: from.createdAt.toISOString(),
  };
  const toMeta: VersionMeta = {
    id: to.id,
    versionNumber: to.version,
    total: to.totalPrice,
    createdAt: to.createdAt.toISOString(),
  };

  const fromById = new Map(from.lineItems.map((l) => [l.id, l]));
  const consumedFrom = new Set<string>();
  const pairedByLineage: Array<{ b: Line; t: Line }> = [];

  for (const t of to.lineItems) {
    const bid = parseBaseItemId(t.metadataJson);
    if (bid && fromById.has(bid) && !consumedFrom.has(bid)) {
      const b = fromById.get(bid)!;
      consumedFrom.add(bid);
      pairedByLineage.push({ b, t });
    }
  }

  const pools = new Map<string, Line[]>();
  for (const li of from.lineItems) {
    if (consumedFrom.has(li.id)) continue;
    const k = normKey(li.category, li.productName);
    const arr = pools.get(k) ?? [];
    arr.push(li);
    pools.set(k, arr);
  }

  const addedItems: DiffAddedItem[] = [];
  const changedItems: DiffChangedItem[] = [];

  function pushChanged(b: Line, t: Line) {
    const fields: DiffChangedItem["fields"] = [];
    if (Math.abs(b.qty - t.qty) > 0.0001) {
      fields.push({
        field: "qty",
        from: String(b.qty),
        to: String(t.qty),
      });
    }
    if (Math.abs(b.salePrice - t.salePrice) > 0.01) {
      fields.push({
        field: "unitPrice",
        from: fmtNum(b.salePrice),
        to: fmtNum(t.salePrice),
      });
    }
    if (Math.abs(b.amountSale - t.amountSale) > 0.5) {
      fields.push({
        field: "total",
        from: fmtNum(b.amountSale),
        to: fmtNum(t.amountSale),
      });
    }
    if (b.productName.trim() !== t.productName.trim()) {
      fields.push({
        field: "title",
        from: b.productName,
        to: t.productName,
      });
    }
    if (
      (b.category ?? "").trim() !== (t.category ?? "").trim() &&
      fields.length === 0
    ) {
      fields.push({
        field: "category",
        from: b.category ?? "—",
        to: t.category ?? "—",
      });
    }

    if (fields.length > 0) {
      changedItems.push({
        title: t.productName,
        category: t.category,
        fields,
      });
    }
  }

  for (const { b, t } of pairedByLineage) {
    pushChanged(b, t);
  }

  for (const t of to.lineItems) {
    if (pairedByLineage.some((p) => p.t.id === t.id)) continue;

    const k = normKey(t.category, t.productName);
    const queue = pools.get(k);
    const b = queue?.shift();
    if (!b) {
      addedItems.push({
        title: t.productName,
        category: t.category,
        qty: t.qty,
        unitPrice: t.salePrice,
        totalPrice: t.amountSale,
      });
      continue;
    }
    consumedFrom.add(b.id);
    pushChanged(b, t);
  }

  const removedItems: DiffRemovedItem[] = [];
  for (const li of from.lineItems) {
    if (consumedFrom.has(li.id)) continue;
    removedItems.push({
      title: li.productName,
      category: li.category,
      qty: li.qty,
      unitPrice: li.salePrice,
      totalPrice: li.amountSale,
    });
  }

  const fromSum = from.lineItems.reduce((a, l) => a + l.amountSale, 0);
  const toSum = to.lineItems.reduce((a, l) => a + l.amountSale, 0);
  const totalDelta = toSum - fromSum;

  return {
    fromVersion: fromMeta,
    toVersion: toMeta,
    summary: {
      added: addedItems.length,
      removed: removedItems.length,
      changed: changedItems.length,
      totalDelta,
    },
    addedItems,
    removedItems,
    changedItems,
  };
}
