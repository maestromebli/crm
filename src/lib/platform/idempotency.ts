import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const IDEMPOTENCY_PREFIX = "idempotency";
const IDEMPOTENCY_EVENT_TYPE = "platform.idempotency.claimed";
const IDEMPOTENCY_HEADER = "x-idempotency-key";

export type IdempotencyClaimInput = {
  key: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  requestId?: string | null;
};

export type IdempotencyClaimResult = {
  accepted: boolean;
  eventId: string | null;
};

export function readIdempotencyKey(req: Request): string | null {
  const key = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
  return key || null;
}

function buildDedupeKey(key: string): string {
  return `${IDEMPOTENCY_PREFIX}:${key}`;
}

export async function claimIdempotencyKey(
  input: IdempotencyClaimInput,
): Promise<IdempotencyClaimResult> {
  if (!input.key.trim()) return { accepted: true, eventId: null };
  const dedupeKey = buildDedupeKey(input.key.trim());

  try {
    const created = await prisma.domainEvent.create({
      data: {
        type: IDEMPOTENCY_EVENT_TYPE,
        dedupeKey,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? null,
        payload: {
          key: input.key.trim(),
          requestId: input.requestId ?? null,
          createdAt: new Date().toISOString(),
        } as Prisma.InputJsonObject,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    return { accepted: true, eventId: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isDuplicate =
      /unique constraint|duplicate key|dedupeKey/i.test(message);
    if (!isDuplicate) throw error;
    const existing = await prisma.domainEvent.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });
    return { accepted: false, eventId: existing?.id ?? null };
  }
}

