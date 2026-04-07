import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export async function logAiEvent(input: {
  userId: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  model?: string | null;
  tokensApprox?: number | null;
  ok?: boolean;
  errorMessage?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return;
  try {
    await prisma.aiAssistantLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        model: input.model ?? null,
        tokensApprox: input.tokensApprox ?? null,
        ok: input.ok ?? true,
        errorMessage: input.errorMessage ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (e) {
    console.error("[logAiEvent]", e);
  }
}
