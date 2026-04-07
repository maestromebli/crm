import { prisma } from "@/lib/prisma";
import { recomputeFlowMetrics } from "./production-flow.service";
import { refreshFlowAiInsights } from "./production-ai.service";

export type ProductionValidationResult = {
  ok: boolean;
  blockers: Array<{
    code: string;
    title: string;
    description: string;
    severity: "HIGH" | "CRITICAL";
  }>;
};

export async function validateLatestFilePackage(flowId: string, actorName: string): Promise<ProductionValidationResult> {
  const latestPackage = await prisma.productionFilePackage.findFirst({
    where: { flowId },
    orderBy: { uploadedAt: "desc" },
    include: { files: true },
  });

  const blockers: ProductionValidationResult["blockers"] = [];

  if (!latestPackage) {
    blockers.push({
      code: "MISSING_PACKAGE",
      title: "Немає пакета файлів",
      description: "Спочатку зареєструйте пакет файлів конструктора.",
      severity: "CRITICAL",
    });
  } else if (latestPackage.files.length < 1) {
    blockers.push({
      code: "EMPTY_PACKAGE",
      title: "Пакет порожній",
      description: "Пакет має містити хоча б один файл або технічний placeholder.",
      severity: "CRITICAL",
    });
  }

  if (latestPackage) {
    const hasTechnicalFile = latestPackage.files.some((file) =>
      /(dxf|spec|pdf|drawing|кресл)/i.test(`${file.fileName} ${file.fileType ?? ""}`),
    );
    if (!hasTechnicalFile) {
      blockers.push({
        code: "NO_TECHNICAL_FILES",
        title: "Немає технічних файлів",
        description: "Потрібні креслення/специфікація для переходу на апрув.",
        severity: "HIGH",
      });
    }
  }

  const criticalQuestions = await prisma.productionQuestion.count({
    where: { flowId, status: "OPEN", isCritical: true },
  });
  if (criticalQuestions > 0) {
    blockers.push({
      code: "CRITICAL_QUESTIONS_OPEN",
      title: "Є критичні відкриті питання",
      description: `Відкритих критичних питань: ${criticalQuestions}.`,
      severity: "HIGH",
    });
  }

  const existingCriticalBlockers = await prisma.productionRisk.count({
    where: { flowId, resolvedAt: null, severity: "CRITICAL" },
  });
  if (existingCriticalBlockers > 0) {
    blockers.push({
      code: "CRITICAL_BLOCKERS_OPEN",
      title: "Є активні критичні блокери",
      description: `Активних критичних блокерів: ${existingCriticalBlockers}.`,
      severity: "CRITICAL",
    });
  }

  await prisma.productionRisk.updateMany({
    where: { flowId, code: { startsWith: "VALIDATION_" }, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });

  for (const blocker of blockers) {
    await prisma.productionRisk.create({
      data: {
        flowId,
        code: `VALIDATION_${blocker.code}`,
        title: blocker.title,
        description: blocker.description,
        severity: blocker.severity,
      },
    });
  }

  const ok = blockers.length === 0;
  await prisma.productionFlow.update({
    where: { id: flowId },
    data: {
      status: ok ? "ACTIVE" : "BLOCKED",
      currentStepKey: ok ? "APPROVED_BY_CHIEF" : "FILES_VALIDATED",
    },
  });
  await prisma.productionFlowStep.update({
    where: { flowId_key: { flowId, key: "FILES_VALIDATED" } },
    data: { state: ok ? "DONE" : "BLOCKED", completedAt: ok ? new Date() : null },
  });
  if (ok) {
    await prisma.productionFlowStep.update({
      where: { flowId_key: { flowId, key: "APPROVED_BY_CHIEF" } },
      data: { state: "AVAILABLE" },
    });
    if (latestPackage) {
      await prisma.productionFilePackage.update({
        where: { id: latestPackage.id },
        data: { validationPassed: true },
      });
    }
  }

  await prisma.productionEvent.create({
    data: {
      flowId,
      type: ok ? "VALIDATION_PASSED" : "VALIDATION_FAILED",
      actorName,
      title: ok ? "Перевірка пакета пройдена" : "Перевірка пакета не пройдена",
      description: ok ? "Пакет готовий до апруву." : `Знайдено блокерів: ${blockers.length}.`,
      metadataJson: { blockers },
    },
  });

  await recomputeFlowMetrics(flowId);
  await refreshFlowAiInsights(flowId);
  return { ok, blockers };
}
