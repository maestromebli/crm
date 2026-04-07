import type { CommEntityType } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { ConversationInsightPayload } from "../ai/conversation-insight";

export async function persistConversationInsight(args: {
  entityType: CommEntityType;
  entityId: string;
  threadId: string;
  data: ConversationInsightPayload;
}): Promise<void> {
  const d = args.data;
  await prisma.commConversationInsight.upsert({
    where: { threadId: args.threadId },
    create: {
      threadId: args.threadId,
      entityType: args.entityType,
      entityId: args.entityId,
      summaryShort: d.summaryShort.slice(0, 2000),
      summaryDetailed: d.summaryDetailed,
      clientIntent: d.clientIntent,
      extractedNeedsJson: d.extractedNeeds as object,
      extractedMeasurementsJson: d.extractedMeasurements as object,
      extractedMaterialsJson: d.extractedMaterials as object,
      extractedBudgetJson: d.extractedBudget
        ? { text: d.extractedBudget }
        : undefined,
      extractedDatesJson: d.extractedDates as object,
      extractedRisksJson: d.extractedRisks as object,
      missingInfoJson: d.missingInfo as object,
      recommendedNextStep: d.recommendedNextStep,
      recommendedReply: d.recommendedReply,
      confidenceScore: d.confidenceScore,
    },
    update: {
      summaryShort: d.summaryShort.slice(0, 2000),
      summaryDetailed: d.summaryDetailed,
      clientIntent: d.clientIntent,
      extractedNeedsJson: d.extractedNeeds as object,
      extractedMeasurementsJson: d.extractedMeasurements as object,
      extractedMaterialsJson: d.extractedMaterials as object,
      extractedBudgetJson: d.extractedBudget
        ? { text: d.extractedBudget }
        : undefined,
      extractedDatesJson: d.extractedDates as object,
      extractedRisksJson: d.extractedRisks as object,
      missingInfoJson: d.missingInfo as object,
      recommendedNextStep: d.recommendedNextStep,
      recommendedReply: d.recommendedReply,
      confidenceScore: d.confidenceScore,
      generatedAt: new Date(),
    },
  });

  await prisma.commThread.update({
    where: { id: args.threadId },
    data: {
      aiSummary: d.summaryShort.slice(0, 4000),
      aiSummaryUpdatedAt: new Date(),
    },
  });
}
