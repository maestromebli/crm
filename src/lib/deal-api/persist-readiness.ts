import type { Prisma, ReadinessOutcome } from "@prisma/client";
import {
  evaluateReadiness,
  allReadinessMet,
} from "../deal-core/readiness";
import type { DealWorkspaceMeta } from "../deal-core/workspace-types";
import { appendActivityLog } from "./audit";
import { prisma } from "../prisma";

function parseMeta(raw: Prisma.JsonValue | null): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
}

function outcomeFromChecks(
  checks: ReturnType<typeof evaluateReadiness>,
): ReadinessOutcome {
  if (checks.length === 0) return "PARTIAL";
  if (checks.every((c) => c.done)) return "READY_PRODUCTION";
  if (checks.every((c) => !c.done)) return "BLOCKED";
  return "PARTIAL";
}

/** Зберігає знімок готовності після змін, що можуть на неї вплинути. Помилки лише логуються. */
export async function persistReadinessSnapshot(
  dealId: string,
  actorUserId: string | null,
): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return;
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { contract: { select: { status: true } } },
    });
    if (!deal) return;

    const attachments = await prisma.attachment.findMany({
      where: { entityType: "DEAL", entityId: dealId },
      select: { category: true },
    });
    const attachmentsByCategory: Record<string, number> = {};
    for (const a of attachments) {
      const k = a.category;
      attachmentsByCategory[k] = (attachmentsByCategory[k] ?? 0) + 1;
    }

    const meta = parseMeta(deal.workspaceMeta);
    const checks = evaluateReadiness({
      meta,
      contractStatus: deal.contract?.status ?? null,
      attachmentsByCategory,
    });
    const allMet = allReadinessMet(checks);
    const outcome = outcomeFromChecks(checks);

    await prisma.readinessEvaluation.create({
      data: {
        dealId,
        outcome,
        allMet,
        checksJson: checks as unknown as Prisma.InputJsonValue,
      },
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "READINESS_SNAPSHOT_SAVED",
      actorUserId,
      data: { outcome, allMet },
    });
  } catch (e) {
     
    console.error("[persistReadinessSnapshot]", e);
  }
}
