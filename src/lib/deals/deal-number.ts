import type { Prisma, PrismaClient } from "@prisma/client";

const DEAL_NUMBER_MAX = 500;
const DEAL_NUMBER_RE = /^(E|EM)-(\d{2,3})$/;

type DealNumberPrefix = "E-" | "EM-";
type ParsedDealNumber = { prefix: DealNumberPrefix; numeric: number };
const DEAL_NUMBER_BASE_YEAR = 2026;

type DealNumberDb = Pick<PrismaClient, "deal" | "productionFlow"> | Prisma.TransactionClient;

function activeDealNumberPrefix(now = new Date()): DealNumberPrefix {
  // Явне бізнес-правило: 2026 -> EM-..., 2027 -> E-..., далі чергування щороку.
  const yearsSinceBase = now.getFullYear() - DEAL_NUMBER_BASE_YEAR;
  return Math.abs(yearsSinceBase) % 2 === 0 ? "EM-" : "E-";
}

function formatDealNumber(prefix: DealNumberPrefix, value: number): string {
  return `${prefix}${String(value).padStart(2, "0")}`;
}

function parseDealNumber(value: unknown): ParsedDealNumber | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  const match = DEAL_NUMBER_RE.exec(normalized);
  if (!match) return null;
  const rawPrefix = match[1];
  if (rawPrefix !== "E" && rawPrefix !== "EM") return null;
  const prefix: DealNumberPrefix = rawPrefix === "EM" ? "EM-" : "E-";
  const numeric = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > DEAL_NUMBER_MAX) {
    return null;
  }
  return { prefix, numeric };
}

export function readDealNumberFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const candidate = (meta as { dealNumber?: unknown }).dealNumber;
  const parsed = parseDealNumber(candidate);
  return parsed ? formatDealNumber(parsed.prefix, parsed.numeric) : null;
}

export async function allocateDealNumber(db: DealNumberDb): Promise<string> {
  const [dealRows, flowRows] = await Promise.all([
    db.deal.findMany({ select: { workspaceMeta: true } }),
    db.productionFlow.findMany({ select: { number: true } }),
  ]);

  const activePrefix = activeDealNumberPrefix();
  const used = new Set<number>();
  for (const row of dealRows) {
    const parsed = parseDealNumber(
      (row.workspaceMeta as { dealNumber?: unknown } | null)?.dealNumber,
    );
    if (parsed && parsed.prefix === activePrefix) used.add(parsed.numeric);
  }

  for (const row of flowRows) {
    const parsed = parseDealNumber(row.number);
    if (parsed && parsed.prefix === activePrefix) used.add(parsed.numeric);
  }

  for (let i = 1; i <= DEAL_NUMBER_MAX; i += 1) {
    if (!used.has(i)) return formatDealNumber(activePrefix, i);
  }

  throw new Error(
    `Вичерпано діапазон номерів замовлень ${activePrefix}01..${activePrefix}${DEAL_NUMBER_MAX}`,
  );
}
