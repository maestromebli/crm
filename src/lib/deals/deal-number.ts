import type { Prisma, PrismaClient } from "@prisma/client";

const DEAL_NUMBER_PREFIX = "E-";
const DEAL_NUMBER_MAX = 500;
const DEAL_NUMBER_RE = /^E-(\d{2,3})$/;

type DealNumberDb = Pick<PrismaClient, "deal" | "productionFlow"> | Prisma.TransactionClient;

function formatDealNumber(value: number): string {
  return `${DEAL_NUMBER_PREFIX}${String(value).padStart(2, "0")}`;
}

function parseDealNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  const match = DEAL_NUMBER_RE.exec(normalized);
  if (!match) return null;
  const numeric = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > DEAL_NUMBER_MAX) {
    return null;
  }
  return numeric;
}

export function readDealNumberFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const candidate = (meta as { dealNumber?: unknown }).dealNumber;
  const numeric = parseDealNumber(candidate);
  return numeric ? formatDealNumber(numeric) : null;
}

export async function allocateDealNumber(db: DealNumberDb): Promise<string> {
  const [dealRows, flowRows] = await Promise.all([
    db.deal.findMany({ select: { workspaceMeta: true } }),
    db.productionFlow.findMany({ select: { number: true } }),
  ]);

  const used = new Set<number>();
  for (const row of dealRows) {
    const numeric = parseDealNumber(
      (row.workspaceMeta as { dealNumber?: unknown } | null)?.dealNumber,
    );
    if (numeric) used.add(numeric);
  }

  for (const row of flowRows) {
    const numeric = parseDealNumber(row.number);
    if (numeric) used.add(numeric);
  }

  for (let i = 1; i <= DEAL_NUMBER_MAX; i += 1) {
    if (!used.has(i)) return formatDealNumber(i);
  }

  throw new Error("Вичерпано діапазон номерів замовлень E-01..E-500");
}
