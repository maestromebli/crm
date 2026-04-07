import { prisma } from "../prisma";

export const SIGNATURE_STALE_TASK_TITLE =
  "[DIIA] Перевірити завислий підпис договору";

export async function closeDiiaSignatureStaleTasks(params: {
  dealId: string;
  resultComment: string;
}): Promise<number> {
  const res = await prisma.task.updateMany({
    where: {
      entityType: "DEAL",
      entityId: params.dealId,
      title: SIGNATURE_STALE_TASK_TITLE,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    data: {
      status: "DONE",
      completedAt: new Date(),
      resultComment: params.resultComment,
    },
  });
  return res.count;
}
