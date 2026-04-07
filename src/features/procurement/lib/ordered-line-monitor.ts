/**
 * Моніторинг позицій закупівель за строками (дедлайн заявки) та фінансами (план / замовлено / факт).
 */

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const p = Number(v);
  return Number.isFinite(p) ? p : 0;
}

export type OrderedLineMonitorRow = {
  rowKey: string;
  dealId: string;
  dealTitle: string;
  requestId: string;
  itemId: string;
  itemName: string;
  requestStatus: string;
  neededByDate: string | null;
  qtyPlanned: number;
  qtyOrdered: number;
  qtyReceived: number;
  /** Планова вартість рядка: qtyPlanned × unit planned. */
  plannedValue: number;
  /** Оцінка замовленого: qtyOrdered × unit planned. */
  orderedValue: number;
  /** Факт отримано: qtyReceived × unit actual. */
  receivedValue: number;
  /** Залишок до повної поставки (шт). */
  qtyRemaining: number;
  /** Залишок вартості за плановою ціною (грн). */
  valueRemainingPlanned: number;
  /** Відхилення фактичної ціни за одиницю від плану (грн/од.), якщо вже є поставка. */
  unitPriceDelta: number;
  deadlineStatus: "overdue" | "soon" | "ok" | "none";
  financeFlag: "overrun" | "on_track" | "saving";
  /** Дні до дедлайну заявки (відносно ref); від’ємне — прострочення. */
  daysUntilDue: number | null;
  /** Виконання по кількості, % (0–100). */
  fulfillmentPct: number;
};

export type OrderedLineMonitorSummary = {
  totalRows: number;
  overdueCount: number;
  soonCount: number;
  /** Відкриті рядки без дати «потрібно до». */
  openWithoutDeadlineCount: number;
  totalPlannedUah: number;
  totalOrderedUah: number;
  totalReceivedUah: number;
  totalRemainingUah: number;
  /** Залишок по рядках з простроченим або «скоро» дедлайном. */
  atRiskRemainingUah: number;
  avgFulfillmentPct: number;
};

export function summarizeOrderedLineMonitor(rows: OrderedLineMonitorRow[]): OrderedLineMonitorSummary {
  let overdueCount = 0;
  let soonCount = 0;
  let openWithoutDeadlineCount = 0;
  let totalPlannedUah = 0;
  let totalOrderedUah = 0;
  let totalReceivedUah = 0;
  let totalRemainingUah = 0;
  let atRiskRemainingUah = 0;
  let fulfillmentSum = 0;

  for (const r of rows) {
    if (r.deadlineStatus === "overdue") overdueCount += 1;
    else if (r.deadlineStatus === "soon") soonCount += 1;
    if (!r.neededByDate && r.qtyRemaining > 0) openWithoutDeadlineCount += 1;
    totalPlannedUah += r.plannedValue;
    totalOrderedUah += r.orderedValue;
    totalReceivedUah += r.receivedValue;
    totalRemainingUah += r.valueRemainingPlanned;
    const fp =
      typeof r.fulfillmentPct === "number" && !Number.isNaN(r.fulfillmentPct)
        ? r.fulfillmentPct
        : Math.min(
            100,
            Math.max(0, Math.round((r.qtyReceived / Math.max(r.qtyPlanned || r.qtyOrdered || 1, 0.0001)) * 100)),
          );
    fulfillmentSum += fp;
    if (r.deadlineStatus === "overdue" || r.deadlineStatus === "soon") {
      atRiskRemainingUah += r.valueRemainingPlanned;
    }
  }

  const n = rows.length;
  return {
    totalRows: n,
    overdueCount,
    soonCount,
    openWithoutDeadlineCount,
    totalPlannedUah,
    totalOrderedUah,
    totalReceivedUah,
    totalRemainingUah,
    atRiskRemainingUah,
    avgFulfillmentPct: n > 0 ? Math.round(fulfillmentSum / n) : 0,
  };
}

const SOON_DAYS = 7;

function deadlineBucket(
  neededByDate: string | null,
  lineStillOpen: boolean,
  ref: Date,
): OrderedLineMonitorRow["deadlineStatus"] {
  if (!neededByDate || !lineStillOpen) return "none";
  const due = new Date(`${neededByDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return "none";
  const startRef = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = (startDue.getTime() - startRef.getTime()) / 86_400_000;
  if (diffDays < 0) return "overdue";
  if (diffDays <= SOON_DAYS) return "soon";
  return "ok";
}

function financeFlagForLine(qtyReceived: number, unitP: number, receivedValue: number): OrderedLineMonitorRow["financeFlag"] {
  if (qtyReceived <= 0) return "on_track";
  const avgActual = receivedValue / qtyReceived;
  if (avgActual > unitP * 1.02) return "overrun";
  if (avgActual < unitP * 0.98) return "saving";
  return "on_track";
}

export type PrismaLikeRequest = {
  id: string;
  dealId: string;
  status: string;
  neededByDate: Date | null;
  deal: { title: string } | null;
  items: Array<{
    id: string;
    name: string | null;
    qtyPlanned: unknown;
    qtyOrdered: unknown;
    qtyReceived: unknown;
    costPlanned: unknown;
    costActual: unknown;
    status: string | null;
  }>;
};

/** Рядок потрапляє в монітор, якщо по ньому ще не закрита поставка за планом або є «висяче» замовлення. */
function shouldIncludeLine(qp: number, qo: number, qr: number): boolean {
  if (qp > 0 && qr < qp) return true;
  if (qp <= 0 && qo > 0 && qr < qo) return true;
  return false;
}

export function buildOrderedLineMonitorFromPrismaRequests(
  requests: PrismaLikeRequest[],
  ref: Date = new Date(),
): OrderedLineMonitorRow[] {
  const rows: OrderedLineMonitorRow[] = [];

  for (const r of requests) {
    const stReq = (r.status ?? "").toUpperCase();
    if (stReq === "CANCELLED") continue;

    const dealTitle = r.deal?.title ?? "—";
    const neededStr = r.neededByDate?.toISOString().slice(0, 10) ?? null;

    for (const it of r.items) {
      const qp = n(it.qtyPlanned);
      const qo = n(it.qtyOrdered);
      const qr = n(it.qtyReceived);
      const unitP = n(it.costPlanned);
      const unitA = n(it.costActual) || unitP;

      const itemSt = (it.status ?? "").toUpperCase();
      if (itemSt === "CANCELLED") continue;

      if (!shouldIncludeLine(qp, qo, qr)) continue;

      const plannedValue = qp * unitP;
      const orderedValue = qo * unitP;
      const receivedValue = qr * unitA;
      const qtyRemaining = Math.max(0, qp > 0 ? qp - qr : qo - qr);
      const valueRemainingPlanned = qp > 0 ? Math.max(0, qp - qr) * unitP : Math.max(0, qo - qr) * unitP;
      const unitPriceDelta = qr > 0 ? unitA - unitP : 0;

      const lineStillOpen = qr < qp || (qp <= 0 && qr < qo);
      const deadlineStatus = deadlineBucket(neededStr, Boolean(lineStillOpen), ref);
      const financeFlag = financeFlagForLine(qr, unitP, receivedValue);

      const startRef = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      let daysUntilDue: number | null = null;
      if (neededStr && lineStillOpen) {
        const due = new Date(`${neededStr}T12:00:00`);
        if (!Number.isNaN(due.getTime())) {
          const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
          daysUntilDue = Math.round((startDue.getTime() - startRef.getTime()) / 86_400_000);
        }
      }

      const denomQty = qp > 0 ? qp : qo > 0 ? qo : 1;
      const fulfillmentPct = Math.min(100, Math.max(0, Math.round((qr / denomQty) * 100)));

      rows.push({
        rowKey: `${r.id}:${it.id}`,
        dealId: r.dealId,
        dealTitle,
        requestId: r.id,
        itemId: it.id,
        itemName: (it.name ?? "").trim() || "—",
        requestStatus: r.status,
        neededByDate: neededStr,
        qtyPlanned: qp,
        qtyOrdered: qo,
        qtyReceived: qr,
        plannedValue,
        orderedValue,
        receivedValue,
        qtyRemaining,
        valueRemainingPlanned,
        unitPriceDelta,
        deadlineStatus,
        financeFlag,
        daysUntilDue,
        fulfillmentPct,
      });
    }
  }

  const rank = (d: OrderedLineMonitorRow["deadlineStatus"]) =>
    d === "overdue" ? 0 : d === "soon" ? 1 : d === "ok" ? 2 : 3;

  return rows.sort((a, b) => {
    const ra = rank(a.deadlineStatus);
    const rb = rank(b.deadlineStatus);
    if (ra !== rb) return ra - rb;
    const da = a.neededByDate ?? "";
    const db = b.neededByDate ?? "";
    return da.localeCompare(db);
  });
}

/** Демо: з mock-заявок і позицій (UI-моделі). */
export function buildOrderedLineMonitorFromMock(
  requests: Array<{
    id: string;
    projectId: string;
    status: string;
    neededByDate: string | null;
  }>,
  items: Array<{
    id: string;
    requestId: string;
    name: string;
    qty: number;
    plannedUnitCost: number;
    actualUnitCost: number | null;
    status: string;
  }>,
  projectNameById: Record<string, string>,
): OrderedLineMonitorRow[] {
  const reqIds = new Set(requests.filter((r) => r.status !== "CANCELLED").map((r) => r.id));
  const prismaLike: PrismaLikeRequest[] = requests
    .filter((r) => r.status !== "CANCELLED")
    .map((r) => ({
      id: r.id,
      dealId: r.projectId,
      status: r.status,
      neededByDate: r.neededByDate ? new Date(`${r.neededByDate}T12:00:00`) : null,
      deal: { title: projectNameById[r.projectId] ?? r.projectId },
      items: [],
    }));
  const byId = new Map(prismaLike.map((p) => [p.id, p]));

  for (const it of items) {
    if (!reqIds.has(it.requestId)) continue;
    const bucket = byId.get(it.requestId);
    if (!bucket) continue;

    const qp = it.qty;
    const unitP = it.plannedUnitCost;
    const unitA = it.actualUnitCost ?? unitP;
    const st = it.status;

    let qr = 0;
    let qo = 0;
    if (st === "RECEIVED") {
      qr = qp;
      qo = qp;
    } else if (st === "ORDERED") {
      qo = qp;
      qr = Math.max(0, Math.floor(qp * 0.55));
    } else if (st === "APPROVED") {
      qo = qp;
      qr = 0;
    } else {
      continue;
    }

    bucket.items.push({
      id: it.id,
      name: it.name,
      qtyPlanned: qp,
      qtyOrdered: qo,
      qtyReceived: qr,
      costPlanned: unitP,
      costActual: unitA,
      status: st,
    });
  }

  return buildOrderedLineMonitorFromPrismaRequests([...byId.values()].filter((b) => b.items.length > 0));
}
