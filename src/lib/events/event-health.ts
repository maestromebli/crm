import { prisma } from "@/lib/prisma";

type EventHealthPoint = {
  day: string;
  created: number;
  processed: number;
};

export type EventHealthSnapshot = {
  generatedAt: string;
  window: {
    last24h: {
      total: number;
      processed: number;
      pending: number;
      processedRate: number;
      dedupeCoverage: number;
    };
    last7d: {
      total: number;
      processed: number;
      pending: number;
      processedRate: number;
    };
  };
  backlog: {
    pendingTotal: number;
    oldestPendingAt: string | null;
    oldestPendingType: string | null;
  };
  topTypes24h: Array<{
    type: string;
    total: number;
    pending: number;
  }>;
  byEntity24h: Array<{
    entityType: string;
    total: number;
  }>;
  trend7d: EventHealthPoint[];
  recent: Array<{
    id: string;
    type: string;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
    processedAt: string | null;
    dedupeKey: string | null;
  }>;
};

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadEventHealthSnapshot(now = new Date()): Promise<EventHealthSnapshot> {
  const d24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    total24,
    processed24,
    pending24,
    dedupe24,
    total7,
    processed7,
    pending7,
    pendingTotal,
    oldestPending,
    topTypesRaw,
    entityRaw,
    recent,
    trendRows,
  ] = await Promise.all([
    prisma.domainEvent.count({ where: { createdAt: { gte: d24 } } }),
    prisma.domainEvent.count({
      where: { createdAt: { gte: d24 }, processedAt: { not: null } },
    }),
    prisma.domainEvent.count({
      where: { createdAt: { gte: d24 }, processedAt: null },
    }),
    prisma.domainEvent.count({
      where: { createdAt: { gte: d24 }, dedupeKey: { not: null } },
    }),
    prisma.domainEvent.count({ where: { createdAt: { gte: d7 } } }),
    prisma.domainEvent.count({
      where: { createdAt: { gte: d7 }, processedAt: { not: null } },
    }),
    prisma.domainEvent.count({
      where: { createdAt: { gte: d7 }, processedAt: null },
    }),
    prisma.domainEvent.count({ where: { processedAt: null } }),
    prisma.domainEvent.findFirst({
      where: { processedAt: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, type: true },
    }),
    prisma.domainEvent.groupBy({
      by: ["type"],
      where: { createdAt: { gte: d24 } },
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
      take: 8,
    }),
    prisma.domainEvent.groupBy({
      by: ["entityType"],
      where: { createdAt: { gte: d24 } },
      _count: { _all: true },
      orderBy: { _count: { entityType: "desc" } },
      take: 8,
    }),
    prisma.domainEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        processedAt: true,
        dedupeKey: true,
      },
    }),
    prisma.domainEvent.findMany({
      where: { createdAt: { gte: d7 } },
      select: { createdAt: true, processedAt: true },
    }),
  ]);

  const pendingPerType = await Promise.all(
    topTypesRaw.map(async (row) => {
      const pending = await prisma.domainEvent.count({
        where: { createdAt: { gte: d24 }, type: row.type, processedAt: null },
      });
      return { type: row.type, total: row._count._all, pending };
    }),
  );

  const trendMap = new Map<string, EventHealthPoint>();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(d7.getTime() + i * 24 * 60 * 60 * 1000);
    trendMap.set(dayKey(d), { day: dayKey(d), created: 0, processed: 0 });
  }
  for (const row of trendRows) {
    const k = dayKey(row.createdAt);
    const point = trendMap.get(k);
    if (!point) continue;
    point.created += 1;
    if (row.processedAt) point.processed += 1;
  }

  return {
    generatedAt: now.toISOString(),
    window: {
      last24h: {
        total: total24,
        processed: processed24,
        pending: pending24,
        processedRate: ratio(processed24, total24),
        dedupeCoverage: ratio(dedupe24, total24),
      },
      last7d: {
        total: total7,
        processed: processed7,
        pending: pending7,
        processedRate: ratio(processed7, total7),
      },
    },
    backlog: {
      pendingTotal,
      oldestPendingAt: oldestPending?.createdAt.toISOString() ?? null,
      oldestPendingType: oldestPending?.type ?? null,
    },
    topTypes24h: pendingPerType,
    byEntity24h: entityRaw.map((x) => ({
      entityType: x.entityType ?? "UNKNOWN",
      total: x._count._all,
    })),
    trend7d: [...trendMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    recent: recent.map((x) => ({
      id: x.id,
      type: x.type,
      entityType: x.entityType ?? null,
      entityId: x.entityId ?? null,
      createdAt: x.createdAt.toISOString(),
      processedAt: x.processedAt?.toISOString() ?? null,
      dedupeKey: x.dedupeKey ?? null,
    })),
  };
}
