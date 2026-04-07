import { prisma } from "../prisma";

/** Воронка лідів за замовчуванням і стадія «Новий» (або перша за sortOrder). */
export async function resolveDefaultLeadStage(): Promise<{
  pipelineId: string;
  stageId: string;
} | null> {
  const pipeline = await prisma.pipeline.findFirst({
    where: { entityType: "LEAD" },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!pipeline?.stages.length) return null;
  const stage =
    pipeline.stages.find((s) => s.slug === "new") ?? pipeline.stages[0];
  return { pipelineId: pipeline.id, stageId: stage.id };
}
