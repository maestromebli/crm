import { dispatchDealAutomationTrigger } from "../automation/dispatch";
import { appendActivityLog } from "../deal-api/audit";
import { prisma } from "../prisma";
import { SIGNATURE_STALE_TASK_TITLE } from "./signature-stale-task";

type WatchdogMeta = {
  lastAlertAt?: string;
  staleAlertCount?: number;
};

function readWatchdogMeta(content: unknown): WatchdogMeta {
  if (!content || typeof content !== "object" || Array.isArray(content)) return {};
  const draft = content as Record<string, unknown>;
  const contentJson =
    draft.contentJson && typeof draft.contentJson === "object" && !Array.isArray(draft.contentJson)
      ? (draft.contentJson as Record<string, unknown>)
      : {};
  const wd =
    contentJson.diiaWatchdog &&
    typeof contentJson.diiaWatchdog === "object" &&
    !Array.isArray(contentJson.diiaWatchdog)
      ? (contentJson.diiaWatchdog as Record<string, unknown>)
      : {};
  return {
    lastAlertAt: typeof wd.lastAlertAt === "string" ? wd.lastAlertAt : undefined,
    staleAlertCount:
      typeof wd.staleAlertCount === "number" ? wd.staleAlertCount : undefined,
  };
}

function mergeWatchdogMeta(content: unknown, next: WatchdogMeta): object {
  const draft =
    content && typeof content === "object" && !Array.isArray(content)
      ? (content as Record<string, unknown>)
      : {};
  const contentJson =
    draft.contentJson && typeof draft.contentJson === "object" && !Array.isArray(draft.contentJson)
      ? (draft.contentJson as Record<string, unknown>)
      : {};
  return {
    ...draft,
    contentJson: {
      ...contentJson,
      diiaWatchdog: {
        ...(contentJson.diiaWatchdog &&
        typeof contentJson.diiaWatchdog === "object" &&
        !Array.isArray(contentJson.diiaWatchdog)
          ? (contentJson.diiaWatchdog as Record<string, unknown>)
          : {}),
        ...next,
      },
    },
  };
}

export async function runDiiaSignatureWatchdog(input?: {
  thresholdHours?: number;
  cooldownHours?: number;
  limit?: number;
  dryRun?: boolean;
}) {
  const thresholdHours = Math.max(1, Number(input?.thresholdHours ?? 48));
  const cooldownHours = Math.max(1, Number(input?.cooldownHours ?? 24));
  const limit = Math.min(500, Math.max(1, Number(input?.limit ?? 100)));
  const dryRun = Boolean(input?.dryRun);

  const now = Date.now();
  const staleBefore = new Date(now - thresholdHours * 60 * 60 * 1000);
  const cooldownMs = cooldownHours * 60 * 60 * 1000;

  const rows = await prisma.dealContract.findMany({
    where: {
      status: "SENT_FOR_SIGNATURE",
      updatedAt: { lte: staleBefore },
    },
    take: limit,
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      dealId: true,
      diiaSessionId: true,
      updatedAt: true,
      content: true,
      deal: {
        select: {
          id: true,
          title: true,
          ownerId: true,
        },
      },
    },
  });

  const stale = rows.map((r) => {
    const meta = readWatchdogMeta(r.content);
    const ageHours = Math.max(0, Math.floor((now - +r.updatedAt) / (60 * 60 * 1000)));
    const lastAlertAtMs = meta.lastAlertAt ? +new Date(meta.lastAlertAt) : 0;
    const inCooldown = lastAlertAtMs > 0 && now - lastAlertAtMs < cooldownMs;
    return {
      contractId: r.id,
      dealId: r.dealId,
      sessionId: r.diiaSessionId,
      updatedAt: r.updatedAt.toISOString(),
      ageHours,
      alertable: !inCooldown,
      staleAlertCount: meta.staleAlertCount ?? 0,
      content: r.content,
      dealTitle: r.deal.title,
      ownerId: r.deal.ownerId,
    };
  });

  let createdTasks = 0;
  if (!dryRun) {
    for (const item of stale) {
      if (!item.alertable) continue;
      const existingTask = await prisma.task.findFirst({
        where: {
          entityType: "DEAL",
          entityId: item.dealId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          title: SIGNATURE_STALE_TASK_TITLE,
        },
        select: { id: true },
      });
      if (!existingTask) {
        const dueAt = new Date();
        dueAt.setHours(23, 59, 59, 999);
        await prisma.task.create({
          data: {
            title: SIGNATURE_STALE_TASK_TITLE,
            description:
              `Договір "${item.dealTitle}" у статусі підпису ${item.ageHours} год. ` +
              "Перевірте статус сесії Дія, зв'яжіться з клієнтом і зафіксуйте результат.",
            entityType: "DEAL",
            entityId: item.dealId,
            taskType: "FOLLOW_UP",
            status: "OPEN",
            priority: item.ageHours >= 72 ? "URGENT" : "HIGH",
            dueAt,
            assigneeId: item.ownerId,
            createdById: item.ownerId,
          },
        });
        createdTasks += 1;
      }
      await appendActivityLog({
        entityType: "DEAL",
        entityId: item.dealId,
        type: "CONTRACT_STATUS_CHANGED",
        actorUserId: null,
        source: "SYSTEM",
        data: {
          status: "SENT_FOR_SIGNATURE",
          action: "signature_stale_alert",
          thresholdHours,
          cooldownHours,
          ageHours: item.ageHours,
          sessionId: item.sessionId,
        },
      });
      await dispatchDealAutomationTrigger({
        dealId: item.dealId,
        trigger: "CONTRACT_SIGNATURE_STALE",
        payload: {
          contractId: item.contractId,
          dealId: item.dealId,
          ageHours: item.ageHours,
          thresholdHours,
          sessionId: item.sessionId,
        },
        startedById: null,
      });
      await prisma.dealContract.update({
        where: { id: item.contractId },
        data: {
          content: mergeWatchdogMeta(item.content, {
            lastAlertAt: new Date().toISOString(),
            staleAlertCount: item.staleAlertCount + 1,
          }) as unknown as object,
        },
      });
    }
  }

  return {
    ok: true,
    dryRun,
    thresholdHours,
    cooldownHours,
    scanned: rows.length,
    staleFound: stale.length,
    alertable: stale.filter((x) => x.alertable).length,
    createdTasks,
    items: stale.map(({ content: _content, ...rest }) => rest),
  };
}
