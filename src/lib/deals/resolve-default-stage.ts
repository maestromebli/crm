import { prisma } from "../prisma";

/** Воронка угод за замовчуванням і перша нефінальна стадія (або перша за sortOrder). */
export async function resolveDefaultDealStage(): Promise<{
  pipelineId: string;
  stageId: string;
} | null> {
  const pipeline = await prisma.pipeline.findFirst({
    where: { entityType: "DEAL" },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!pipeline?.stages.length) return null;
  const stage =
    pipeline.stages.find((s) => !s.isFinal) ?? pipeline.stages[0];
  return { pipelineId: pipeline.id, stageId: stage.id };
}
