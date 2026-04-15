import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logAiEvent } from "./log-ai-event";

type LearningScope = {
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  take?: number;
};

type LearningEventInput = {
  userId: string;
  action: string;
  stage: string;
  entityType?: string | null;
  entityId?: string | null;
  ok?: boolean;
  metadata?: Prisma.InputJsonValue;
};

function normalizeTake(take?: number): number {
  if (!Number.isFinite(take)) return 12;
  return Math.max(1, Math.min(30, Math.floor(take as number)));
}

function normalizeAction(action: string): string {
  return action.replace(/_/g, " ").trim();
}

function metaValue(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>)[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "boolean") return raw ? "true" : "false";
  return null;
}

function toLearningLine(row: {
  createdAt: Date;
  action: string;
  ok: boolean;
  metadata: unknown;
}): string {
  const when = row.createdAt.toISOString();
  const action = normalizeAction(row.action);
  const stage = metaValue(row.metadata, "stage");
  const style = metaValue(row.metadata, "style");
  const operation = metaValue(row.metadata, "operation");
  const tagged = [stage, style, operation].filter(Boolean).join(", ");
  const suffix = tagged ? ` (${tagged})` : "";
  const quality = row.ok ? "ok" : "fail";
  return `- ${when}: ${action}${suffix} [${quality}]`;
}

export async function buildContinuousLearningBlock(
  scope: LearningScope,
): Promise<string> {
  if (!process.env.DATABASE_URL?.trim()) return "";

  const where: Prisma.AiAssistantLogWhereInput = {};
  if (scope.userId?.trim()) where.userId = scope.userId.trim();
  if (scope.entityType?.trim()) where.entityType = scope.entityType.trim();
  if (scope.entityId?.trim()) where.entityId = scope.entityId.trim();
  if (
    !where.userId &&
    !(where.entityType && where.entityId)
  ) {
    return "";
  }

  try {
    const rows = await prisma.aiAssistantLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: normalizeTake(scope.take),
      select: {
        createdAt: true,
        action: true,
        ok: true,
        metadata: true,
      },
    });
    if (!rows.length) return "";

    const lines = rows.map(toLearningLine).join("\n");
    return `Continuous learning memory (recent AI events):\n${lines}`;
  } catch (e) {
    console.error("[buildContinuousLearningBlock]", e);
    return "";
  }
}

export async function recordContinuousLearningEvent(
  input: LearningEventInput,
): Promise<void> {
  await logAiEvent({
    userId: input.userId,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    ok: input.ok ?? true,
    metadata: {
      stage: input.stage,
      ...(input.metadata && typeof input.metadata === "object"
        ? (input.metadata as Record<string, unknown>)
        : {}),
    },
  });
}

export async function buildLearningKnowledgeBlock(scope: {
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  take?: number;
  action?: string;
}): Promise<string> {
  if (!process.env.DATABASE_URL?.trim()) return "";

  const where: Prisma.AiAssistantLogWhereInput = {
    action: scope.action ?? "settings_admin_knowledge",
  };
  if (scope.userId?.trim()) where.userId = scope.userId.trim();
  if (scope.entityType?.trim()) where.entityType = scope.entityType.trim();
  if (scope.entityId?.trim()) where.entityId = scope.entityId.trim();

  try {
    const rows = await prisma.aiAssistantLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: normalizeTake(scope.take),
      select: {
        createdAt: true,
        metadata: true,
      },
    });
    if (!rows.length) return "";

    const notes = rows
      .map((row) => {
        const note = metaValue(row.metadata, "note");
        if (!note) return null;
        return `- ${row.createdAt.toISOString()}: ${note}`;
      })
      .filter((x): x is string => Boolean(x));

    if (!notes.length) return "";
    return `Admin provided knowledge notes:\n${notes.join("\n")}`;
  } catch (e) {
    console.error("[buildLearningKnowledgeBlock]", e);
    return "";
  }
}
