import { prisma } from "@/lib/prisma";
import type { ConstructorQuestion } from "@prisma/client";
import { constructorQuestionAnswerSchema, constructorQuestionSchema } from "./constructor-validation";
import { createConstructorTimelineEvent } from "./constructor-timeline.service";

export async function createConstructorQuestion(input: {
  workspaceId: string;
  actorUserId: string;
  payload: unknown;
}): Promise<ConstructorQuestion> {
  const parsed = constructorQuestionSchema.parse(input.payload);
  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: input.workspaceId },
  });
  if (!workspace) throw new Error("Workspace не найден");

  const row = await prisma.constructorQuestion.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: input.actorUserId,
      assignedToUserId: parsed.assignedToUserId ?? null,
      assignedRole: parsed.assignedRole ?? null,
      category: parsed.category,
      priority: parsed.priority,
      status: "OPEN",
      title: parsed.title,
      description: parsed.description,
      isCritical: parsed.isCritical ?? parsed.priority === "CRITICAL",
      isPinned: parsed.isPinned ?? false,
    },
  });

  await prisma.constructorWorkspace.update({
    where: { id: workspace.id },
    data: {
      status: workspace.status === "REVIEWING_INPUT" ? "QUESTIONS_OPEN" : workspace.status,
    },
  });

  await createConstructorTimelineEvent({
    workspaceId: workspace.id,
    dealId: workspace.dealId,
    productionFlowId: workspace.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: "QUESTION_CREATED",
    title: "Создан вопрос",
    description: row.title,
    metadataJson: { questionId: row.id },
  });
  return row;
}

export async function answerConstructorQuestion(input: {
  questionId: string;
  actorUserId: string;
  payload: unknown;
}): Promise<ConstructorQuestion> {
  const parsed = constructorQuestionAnswerSchema.parse(input.payload);
  const question = await prisma.constructorQuestion.findUnique({
    where: { id: input.questionId },
    include: {
      workspace: true,
    },
  });
  if (!question) throw new Error("Question не найден");

  const updated = await prisma.constructorQuestion.update({
    where: { id: question.id },
    data: {
      answerText: parsed.answerText,
      answeredByUserId: input.actorUserId,
      answeredAt: new Date(),
      status: parsed.closeAfterAnswer ? "CLOSED" : "ANSWERED",
      closedAt: parsed.closeAfterAnswer ? new Date() : null,
    },
  });

  await createConstructorTimelineEvent({
    workspaceId: question.workspaceId,
    dealId: question.workspace.dealId,
    productionFlowId: question.workspace.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: parsed.closeAfterAnswer ? "QUESTION_CLOSED" : "QUESTION_ANSWERED",
    title: parsed.closeAfterAnswer ? "Вопрос закрыт" : "Ответ на вопрос",
    description: question.title,
    metadataJson: { questionId: question.id },
  });

  return updated;
}

export async function closeConstructorQuestion(input: {
  questionId: string;
  actorUserId: string;
}): Promise<ConstructorQuestion> {
  const question = await prisma.constructorQuestion.findUnique({
    where: { id: input.questionId },
    include: { workspace: true },
  });
  if (!question) throw new Error("Question не найден");
  const updated = await prisma.constructorQuestion.update({
    where: { id: question.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });
  await createConstructorTimelineEvent({
    workspaceId: question.workspaceId,
    dealId: question.workspace.dealId,
    productionFlowId: question.workspace.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: "QUESTION_CLOSED",
    title: "Вопрос закрыт",
    description: question.title,
    metadataJson: { questionId: question.id },
  });
  return updated;
}
