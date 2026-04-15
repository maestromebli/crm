import { jsonError, jsonSuccess } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canAnswerConstructorQuestion } from "@/features/constructor-hub/server/constructor-rbac";
import { answerConstructorQuestion } from "@/features/constructor-hub/server/constructor-question.service";

type Ctx = { params: Promise<{ questionId: string }> };

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  const { questionId } = await context.params;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  const question = await prisma.constructorQuestion.findUnique({
    where: { id: questionId },
    include: {
      workspace: {
        include: {
          deal: { select: { ownerId: true } },
        },
      },
    },
  });
  if (!question) return jsonError(requestId, "Вопрос не найден", 404);

  const scope = {
    ...question.workspace,
    dealOwnerId: question.workspace.deal.ownerId,
  };
  if (!canAnswerConstructorQuestion(user, scope)) {
    return jsonError(requestId, "Недостаточно прав", 403);
  }
  try {
    const payload = await request.json();
    const data = await answerConstructorQuestion({
      questionId,
      actorUserId: user.id,
      payload,
    });
    return jsonSuccess(requestId, { data });
  } catch (e) {
    return jsonError(requestId, e instanceof Error ? e.message : "Ошибка ответа на вопрос", 400);
  }
}
