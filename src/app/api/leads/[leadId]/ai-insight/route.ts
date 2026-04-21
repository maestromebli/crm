import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import { extractFirstJsonObject } from "../../../../../lib/ai/extract-json";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  buildContinuousLearningBlock,
  recordContinuousLearningEvent,
} from "../../../../../lib/ai/continuous-learning";
import { prisma } from "../../../../../lib/prisma";
import { requireAiRateLimit } from "../../../../../lib/ai/route-guard";
import { logAiEvent } from "../../../../../lib/ai/log-ai-event";
import { openAiChatCompletionText } from "../../../../../features/ai/core/openai-client";
import { evaluateAiTextQuality } from "../../../../../lib/ai/evals/quality";

type Ctx = { params: Promise<{ leadId: string }> };

type StageOpt = { id: string; name: string; slug: string };

function normalizeTips(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    return await postLeadAiInsight(req, ctx);
  } catch (e) {
     
    console.error("[POST ai-insight] unhandled", e);
    return NextResponse.json(
      { error: "Внутрішня помилка під час аналізу ШІ." },
      { status: 500 },
    );
  }
}

async function postLeadAiInsight(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const limited = await requireAiRateLimit({
    userId: user.id,
    action: "lead_ai_insight",
    maxRequests: 20,
    windowMinutes: 10,
  });
  if (limited) return limited;

  const { leadId } = await ctx.params;

  let body: { autoApplyStage?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const autoApplyStage = Boolean(body.autoApplyStage);

  const leadRow = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      ownerId: true,
      pipelineId: true,
      title: true,
      source: true,
      priority: true,
      stageId: true,
      contactName: true,
      phone: true,
      email: true,
      note: true,
      stage: { select: { id: true, name: true, slug: true } },
      pipeline: { select: { name: true } },
      owner: { select: { name: true, email: true } },
      contact: {
        select: { fullName: true, phone: true, email: true },
      },
      deals: {
        where: { status: "OPEN" },
        take: 1,
        select: { title: true, stage: { select: { name: true } } },
      },
    },
  });

  if (!leadRow) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const viewDenied = await forbidUnlessLeadAccess(user, P.LEADS_VIEW, leadRow);
  if (viewDenied) return viewDenied;

  const [msgCount, fileCount, recentMessages] = await Promise.all([
    prisma.leadMessage.count({ where: { leadId } }),
    prisma.attachment.count({
      where: {
        entityType: "LEAD",
        entityId: leadId,
        deletedAt: null,
      },
    }),
    prisma.leadMessage.findMany({
      where: { leadId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        body: true,
        channel: true,
        interactionKind: true,
        occurredAt: true,
        createdAt: true,
      },
    }),
  ]);

  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: leadRow.pipelineId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, isFinal: true },
  });

  const stageOpts: StageOpt[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
  }));
  const stageIdSet = new Set(stageOpts.map((s) => s.id));

  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";

  const dealHint = leadRow.deals[0];
  const contextLines = [
    `Назва: ${leadRow.title}`,
    `Воронка: ${leadRow.pipeline.name}, поточна стадія: ${leadRow.stage.name} (id=${leadRow.stageId})`,
    `Джерело: ${leadRow.source}, пріоритет: ${leadRow.priority}`,
    `Відповідальний: ${leadRow.owner.name ?? "assigned_manager"}`,
    "Контактні реквізити клієнта: [приховано для AI-контексту]",
  ];
  if (dealHint) {
    contextLines.push(
      `Відкрита замовлення: ${dealHint.title} · ${dealHint.stage.name}`,
    );
  }
  contextLines.push(
    `Внутрішні повідомлення по ліду: ${msgCount}, файлів: ${fileCount}`,
  );
  if (recentMessages.length > 0) {
    const digest = recentMessages
      .map((m) => {
        const at = (m.occurredAt ?? m.createdAt).toISOString();
        const body = m.body.replace(/\s+/g, " ").trim().slice(0, 220);
        return `[${at}] ${m.channel}/${m.interactionKind}: ${body}`;
      })
      .join("\n");
    contextLines.push(`Останні події комунікаційного центру:\n${digest}`);
  }

  const stagesJson = JSON.stringify(
    stages.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      isFinal: s.isFinal,
    })),
  );

  if (!apiKey) {
    await recordContinuousLearningEvent({
      userId: user.id,
      action: "lead_ai_insight",
      stage: "lead_stage_insight",
      entityType: "LEAD",
      entityId: leadId,
      ok: false,
      metadata: { reason: "missing_api_key" },
    });
    return NextResponse.json({
      configured: false,
      summary:
        "ШІ не налаштовано: додайте AI_API_KEY у .env. Після цього тут зʼявиться аналіз і рекомендація стадії.",
      managerTips: [
        "Перевірте телефон та джерело ліда перед першим дзвінком.",
        "Зафіксуйте наступний крок у задачах на вкладці «Задачі».",
      ],
      recommendedStageId: null,
      recommendedStageName: null,
      currentStageId: leadRow.stageId,
      currentStageName: leadRow.stage.name,
      reason: "Модель не викликалась — немає ключа API.",
      confidence: "low" as const,
      appliedStage: false,
    });
  }

  const userPrompt = `Ти аналітик для CRM корпусних меблів (Україна). Допоможи менеджеру.

Контекст ліда:
${contextLines.join("\n")}

Доступні стадії воронки (JSON масив, поле id — єдине дійсне для recommendedStageId):
${stagesJson}

Поточний stageId: "${leadRow.stageId}"

Поверни ЛИШЕ валідний JSON (без markdown), формат:
{
  "summary": "короткий підсумок ситуації українською, 2-4 речення",
  "managerTips": ["порада 1", "порада 2", "до 5 пунктів"],
  "recommendedStageId": "<один з id з масиву вище або null якщо залишити поточну>",
  "stayOnCurrent": true або false,
  "reason": "чому така стадія, українською, 1-2 речення",
  "confidence": "low" | "medium" | "high"
}

Правила:
- Якщо даних мало — recommendedStageId: null, stayOnCurrent: true, confidence: "low".
- Не вигадуй id стадій — тільки зі списку.
- Фінальні стадії (isFinal true) обирай лише якщо логічно закрити лід.`;
  const memory = await buildContinuousLearningBlock({
    userId: user.id,
    entityType: "LEAD",
    entityId: leadId,
    take: 12,
  });
  const promptWithMemory = memory
    ? `${memory}\n\n${userPrompt}`
    : userPrompt;

  let parsed: {
    summary?: string;
    managerTips?: unknown;
    recommendedStageId?: string | null;
    stayOnCurrent?: boolean;
    reason?: string;
    confidence?: string;
  };
  let aiUsage:
    | { promptTokens: number; completionTokens: number; totalTokens: number }
    | null = null;
  let aiTokensApprox = 0;
  let aiCostUsdApprox: number | null = null;
  let aiModelUsed = model;

  try {
    const response = await openAiChatCompletionText({
      messages: [
        {
          role: "system",
          content:
            "Ти повертаєш лише JSON без пояснень. Ключі англійською як у інструкції, текстові значення українською.",
        },
        { role: "user", content: promptWithMemory },
      ],
      temperature: 0.25,
      maxTokens: 900,
    });

    if (response.ok === false) {
      await logAiEvent({
        userId: user.id,
        action: "lead_ai_insight",
        model,
        ok: false,
        errorMessage: response.error,
        entityType: "LEAD",
        entityId: leadId,
      });
      return NextResponse.json(
        {
          error: `AI HTTP ${response.httpStatus ?? 502}`,
          detail: response.error.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const rawAi = response.content;
    aiUsage = response.usage;
    aiTokensApprox = response.tokensApprox;
    aiCostUsdApprox = response.costUsdApprox;
    aiModelUsed = response.model;
    if (!rawAi.trim()) {
      return NextResponse.json(
        { error: "Провайдер ШІ повернув порожню відповідь" },
        { status: 502 },
      );
    }
    parsed = extractFirstJsonObject(rawAi) as typeof parsed;
  } catch (e) {
     
    console.error("[ai-insight] parse/call", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error && e.message === "JSON_NOT_FOUND"
            ? "Не вдалося розпарсити відповідь ШІ"
            : "Помилка звернення до ШІ",
      },
      { status: 502 },
    );
  }

  let recommendedStageId: string | null =
    typeof parsed.recommendedStageId === "string" &&
    parsed.recommendedStageId.trim()
      ? parsed.recommendedStageId.trim()
      : null;

  if (recommendedStageId && !stageIdSet.has(recommendedStageId)) {
    recommendedStageId = null;
  }

  if (parsed.stayOnCurrent === true) {
    recommendedStageId = null;
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "Без короткого підсумку.";

  const managerTips = normalizeTips(parsed.managerTips);
  const reason =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : "";
  const confidenceRaw =
    typeof parsed.confidence === "string"
      ? parsed.confidence.toLowerCase()
      : "low";
  const confidence =
    confidenceRaw === "high" || confidenceRaw === "medium"
      ? confidenceRaw
      : "low";

  const recommendedStageName = recommendedStageId
    ? (stageOpts.find((s) => s.id === recommendedStageId)?.name ?? null)
    : null;

  let appliedStage = false;

  if (
    autoApplyStage &&
    recommendedStageId &&
    recommendedStageId !== leadRow.stageId
  ) {
    const updateDenied = await forbidUnlessLeadAccess(
      user,
      P.LEADS_UPDATE,
      leadRow,
    );
    if (updateDenied) {
      return NextResponse.json({
        configured: true,
        summary,
        managerTips,
        recommendedStageId,
        recommendedStageName,
        currentStageId: leadRow.stageId,
        currentStageName: leadRow.stage.name,
        reason,
        confidence,
        appliedStage: false,
        autoApplyBlocked:
          "Недостатньо прав на оновлення ліда — стадію можна змінити вручну.",
      });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { stageId: recommendedStageId },
    });

    await appendActivityLog({
      entityType: "LEAD",
      entityId: leadId,
      type: "LEAD_UPDATED",
      actorUserId: user.id,
      data: {
        fields: ["stageId"],
        source: "ai_insight_auto",
        fromStageId: leadRow.stageId,
        toStageId: recommendedStageId,
      },
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/activity`);
    appliedStage = true;
  }

  await recordContinuousLearningEvent({
    userId: user.id,
    action: "lead_ai_insight",
    stage: "lead_stage_insight",
    entityType: "LEAD",
    entityId: leadId,
    ok: true,
    metadata: {
      recommendedStageId,
      appliedStage,
      confidence,
      usedLearningMemory: Boolean(memory),
      qualityScore: evaluateAiTextQuality({
        text: summary,
        maxSentences: 6,
        minChars: 12,
        requireUkrainian: true,
        allowMarkdown: false,
      }).score,
    },
  });
  await logAiEvent({
    userId: user.id,
    action: "lead_ai_insight",
    model: aiModelUsed,
    ok: true,
    tokensApprox:
      aiUsage?.totalTokens && aiUsage.totalTokens > 0
        ? aiUsage.totalTokens
        : aiTokensApprox,
    entityType: "LEAD",
    entityId: leadId,
    metadata: {
      recommendedStageId,
      appliedStage,
      confidence,
      usedLearningMemory: Boolean(memory),
      promptTokens: aiUsage?.promptTokens ?? 0,
      completionTokens: aiUsage?.completionTokens ?? 0,
      totalTokens: aiUsage?.totalTokens ?? 0,
      tokensApprox: aiTokensApprox,
      costUsdApprox: aiCostUsdApprox,
    },
  });

  return NextResponse.json({
    configured: true,
    summary,
    managerTips,
    recommendedStageId,
    recommendedStageName,
    currentStageId: appliedStage
      ? recommendedStageId!
      : leadRow.stageId,
    currentStageName: appliedStage
      ? (recommendedStageName ?? leadRow.stage.name)
      : leadRow.stage.name,
    reason,
    confidence,
    appliedStage,
  });
}
