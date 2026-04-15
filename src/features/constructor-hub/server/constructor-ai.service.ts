import { prisma } from "@/lib/prisma";
import type { ConstructorAIInsight } from "@prisma/client";

export async function runConstructorWorkspaceAICheck(workspaceId: string): Promise<ConstructorAIInsight[]> {
  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      questions: true,
      files: true,
      techSpec: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });
  if (!workspace) throw new Error("Workspace не найден");

  const alerts: Array<{
    type: ConstructorAIInsight["type"];
    severity: ConstructorAIInsight["severity"];
    title: string;
    description: string;
  }> = [];

  const openCritical = workspace.questions.filter((q) => q.isCritical && q.status !== "CLOSED");
  if (openCritical.length > 0) {
    alerts.push({
      type: "OPEN_QUESTION",
      severity: "HIGH",
      title: "Есть незакрытые критические вопросы",
      description: `Критических вопросов: ${openCritical.length}`,
    });
  }

  const hasMeasurement = workspace.files.some((f) => f.fileCategory === "MEASUREMENT" && !f.isArchived);
  if (!hasMeasurement) {
    alerts.push({
      type: "MISSING_DATA",
      severity: "CRITICAL",
      title: "Не загружены замеры",
      description: "Отсутствуют актуальные файлы категории MEASUREMENT.",
    });
  }

  const hasSpec = workspace.files.some((f) => f.fileCategory === "SPECIFICATION" && !f.isArchived);
  if (!hasSpec) {
    alerts.push({
      type: "MISSING_DATA",
      severity: "HIGH",
      title: "Нет спецификации",
      description: "Не найден файл категории SPECIFICATION.",
    });
  }

  if (!workspace.techSpec?.approvedDataSnapshotJson) {
    alerts.push({
      type: "MISSING_DATA",
      severity: "CRITICAL",
      title: "Нет approved snapshot",
      description: "Для workspace отсутствует стабильный approvedDataSnapshotJson.",
    });
  }

  if ((workspace.versions[0]?.summary ?? "").trim().length < 10) {
    alerts.push({
      type: "WARNING",
      severity: "MEDIUM",
      title: "Слабое описание версии",
      description: "Summary версии слишком короткое.",
    });
  }

  await prisma.constructorAIInsight.updateMany({
    where: { workspaceId, isResolved: false },
    data: { isResolved: true, resolvedAt: new Date() },
  });

  if (alerts.length === 0) {
    alerts.push({
      type: "RECOMMENDATION",
      severity: "LOW",
      title: "Проверка завершена",
      description: "Критических блокеров не найдено.",
    });
  }

  const created: ConstructorAIInsight[] = [];
  for (const alert of alerts) {
    const row = await prisma.constructorAIInsight.create({
      data: {
        workspaceId,
        versionId: workspace.versions[0]?.id ?? null,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        sourceRefJson: {},
      },
    });
    created.push(row);
  }

  await prisma.constructorTimelineEvent.create({
    data: {
      workspaceId,
      actorUserId: null,
      eventType: "AI_CHECK_RUN",
      title: "Запущена AI-проверка",
      description: `Найдено сигналов: ${created.length}`,
    },
  });

  return created;
}
