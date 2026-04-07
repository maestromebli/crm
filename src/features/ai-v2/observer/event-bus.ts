import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AiV2EventType } from "../core/types";

type AiV2EventEnvelope = {
  type: AiV2EventType;
  entityType: "LEAD" | "DEAL" | "DASHBOARD";
  entityId: string;
  actorUserId?: string;
  dealId?: string;
  payload?: Prisma.InputJsonValue;
  dedupeKey?: string;
};

type AiV2Subscriber = (event: AiV2EventEnvelope) => Promise<void> | void;

const subscribers = new Map<AiV2EventType, Set<AiV2Subscriber>>();

function payloadObject(
  payload: Prisma.InputJsonValue | undefined,
): Prisma.InputJsonObject {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload as Prisma.InputJsonObject;
}

export function subscribeAiV2Event(
  eventType: AiV2EventType,
  handler: AiV2Subscriber,
): () => void {
  const current = subscribers.get(eventType) ?? new Set<AiV2Subscriber>();
  current.add(handler);
  subscribers.set(eventType, current);
  return () => {
    current.delete(handler);
    if (current.size === 0) {
      subscribers.delete(eventType);
    }
  };
}

async function dispatchAiV2Event(event: AiV2EventEnvelope): Promise<void> {
  const handlers = subscribers.get(event.type);
  if (!handlers || handlers.size === 0) return;
  await Promise.allSettled([...handlers].map((handler) => Promise.resolve(handler(event))));
}

export async function publishAiV2Event(event: AiV2EventEnvelope): Promise<string | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    await dispatchAiV2Event(event);
    return null;
  }
  try {
    const created = await prisma.domainEvent.create({
      data: {
        type: `ai_v2.${event.type}`,
        dealId: event.entityType === "DEAL" ? event.entityId : event.dealId ?? null,
        payload: {
          entityType: event.entityType,
          entityId: event.entityId,
          actorUserId: event.actorUserId ?? null,
          ...payloadObject(event.payload),
        } as Prisma.InputJsonValue,
        dedupeKey: event.dedupeKey,
      },
      select: { id: true },
    });
    await dispatchAiV2Event(event);
    return created.id;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[publishAiV2Event]", error);
    }
    return null;
  }
}
