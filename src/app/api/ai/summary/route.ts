import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../lib/authz/permissions";
import { getSessionAccess } from "../../../../lib/authz/session-access";
import {
  getDashboardPerms,
  loadDashboardSnapshot,
} from "../../../../features/dashboard/queries";
import { loadCrmDashboardAnalytics } from "../../../../features/crm-dashboard/analytics";
import { buildServerDashboardAiContext } from "../../../../lib/ai/dashboard-ai-context";
import {
  buildContinuousLearningBlock,
  recordContinuousLearningEvent,
} from "../../../../lib/ai/continuous-learning";
import { logAiEvent } from "../../../../lib/ai/log-ai-event";
import { requireAiRateLimit } from "../../../../lib/ai/route-guard";
import { openAiChatCompletionText } from "../../../../features/ai/core/openai-client";
import { evaluateAiTextQuality } from "../../../../lib/ai/evals/quality";

export const runtime = "nodejs";

const bodySchema = z.object({
  type: z.string().max(200).optional().default("general"),
  context: z.string().max(50_000).optional().default(""),
  period: z.enum(["today", "week", "month"]).optional(),
});

/**
 * Підсумок для UI. Для `type=dashboard` контекст будується на сервері з RBAC-фільтрами.
 */
export async function POST(request: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const permCtx = {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  };

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні дані", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { type, context, period } = parsed.data;
  const limited = await requireAiRateLimit({
    userId: user.id,
    action: "ai_summary",
    maxRequests: 20,
    windowMinutes: 10,
  });
  if (limited) return limited;

  if (type === "executive_dashboard") {
    const canAi =
      hasEffectivePermission(user.permissionKeys, P.AI_USE, permCtx) ||
      hasEffectivePermission(user.permissionKeys, P.DASHBOARD_VIEW, permCtx);
    if (!canAi) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }
    const trimmed = context.trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: "Потрібен контекст (context) для executive_dashboard" },
        { status: 400 },
      );
    }
    const memory = await buildContinuousLearningBlock({
      userId: user.id,
      take: 12,
    });
    const contextual = memory ? `${memory}\n\n${trimmed}` : trimmed;
    return runOpenAi(
      `Тип: executive_dashboard (оновлення текстового підсумку для UI).\nКонтекст:\n${trimmed}`,
      type,
      user.id,
      contextual,
    );
  }

  const isDashboard =
    type === "dashboard" || type === "crm_dashboard";

  if (isDashboard) {
    const canAi =
      hasEffectivePermission(user.permissionKeys, P.AI_USE, permCtx) ||
      hasEffectivePermission(user.permissionKeys, P.DASHBOARD_VIEW, permCtx);
    if (!canAi) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const access = await getSessionAccess();
    if (!access) {
      return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
    }

    const perms = getDashboardPerms(access);
    const p = period ?? "week";
    const [snapshot, analytics] = await Promise.all([
      loadDashboardSnapshot(access, perms),
      loadCrmDashboardAnalytics(access, perms, p),
    ]);
    const serverContext = buildServerDashboardAiContext({
      access,
      snapshot,
      analytics,
    });
    const memory = await buildContinuousLearningBlock({
      userId: user.id,
      entityType: "DASHBOARD",
      entityId: user.id,
      take: 12,
    });
    const contextual = memory ? `${memory}\n\n${serverContext}` : serverContext;
    return runOpenAi(serverContext, type, user.id, contextual);
  }

  const canLegacy =
    hasEffectivePermission(user.permissionKeys, P.DASHBOARD_VIEW, permCtx) ||
    hasEffectivePermission(user.permissionKeys, P.LEADS_VIEW, permCtx) ||
    hasEffectivePermission(user.permissionKeys, P.NOTIFICATIONS_VIEW, permCtx);
  if (!canLegacy) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const trimmed = context.trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "Потрібен контекст (context)" },
      { status: 400 },
    );
  }

  const memory = await buildContinuousLearningBlock({
    userId: user.id,
    take: 12,
  });
  const contextual = memory
    ? `${memory}\n\n${trimmed}`
    : trimmed;
  return runOpenAi(
    `Тип: ${type}.\nКонтекст (перевірте на відповідність політиці безпеки):\n${trimmed}`,
    type,
    user.id,
    contextual,
  );
}

async function runOpenAi(
  contextBlock: string,
  type: string,
  userId: string,
  learningContext?: string,
) {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    return NextResponse.json(
      {
        text:
          "AI не налаштований: відсутній AI_API_KEY у змінних середовища. Заповніть його в .env та перезапустіть сервер.",
      },
      { status: 200 },
    );
  }

  const prompt =
    type === "executive_dashboard"
      ? `You are an AI assistant for ENVER CRM (custom furniture, Ukraine).
Rewrite and tighten the executive summary for the director UI in Ukrainian.
Return 3–5 short sentences as one block, no greeting, no markdown.
Context:
${learningContext ?? contextBlock}`
      : `You are an AI assistant for ENVER CRM (custom furniture CRM for Ukrainian market).
Generate a short Ukrainian summary (max 3 sentences) for UI display.
Context type: ${type}.

Context:
${learningContext ?? contextBlock}`;

  try {
    const result = await openAiChatCompletionText({
      messages: [
        {
          role: "system",
          content:
            "Ти помічник ENVER CRM. Пиши українською, стисло, без привітання.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      maxTokens: 220,
    });

    if (result.ok === false) {
      await logAiEvent({
        userId,
        action: "ai_summary",
        model,
        ok: false,
        errorMessage: result.error,
        metadata: { type, usedLearningMemory: Boolean(learningContext) },
      });
      return NextResponse.json(
        {
          error: `Помилка AI (${result.httpStatus ?? 502})`,
          text: result.error.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const content = result.content || "AI не надіслав контент. Перевірте модель та ключ.";
    const quality = evaluateAiTextQuality({
      text: content,
      maxSentences: type === "executive_dashboard" ? 5 : 3,
      minChars: 18,
      requireUkrainian: true,
      allowMarkdown: false,
    });

    await recordContinuousLearningEvent({
      userId,
      action: "ai_summary",
      stage: "summary",
      entityType: "DASHBOARD",
      entityId: userId,
      ok: true,
      metadata: {
        type,
        usedLearningMemory: Boolean(learningContext),
        promptTokens: result.usage?.promptTokens ?? 0,
        completionTokens: result.usage?.completionTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        tokensApprox: result.tokensApprox,
        costUsdApprox: result.costUsdApprox,
        qualityScore: quality.score,
        qualityViolations: quality.violations,
      },
    });

    await logAiEvent({
      userId,
      action: "ai_summary",
      model: result.model,
      ok: true,
      tokensApprox:
        result.usage?.totalTokens && result.usage.totalTokens > 0
          ? result.usage.totalTokens
          : result.tokensApprox,
      metadata: {
        type,
        usedLearningMemory: Boolean(learningContext),
        promptTokens: result.usage?.promptTokens ?? 0,
        completionTokens: result.usage?.completionTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        tokensApprox: result.tokensApprox,
        costUsdApprox: result.costUsdApprox,
        qualityScore: quality.score,
        qualityViolations: quality.violations,
      },
    });

    return NextResponse.json({ text: content, quality });
  } catch (error) {
    await logAiEvent({
      userId,
      action: "ai_summary",
      model,
      ok: false,
      errorMessage: (error as Error).message,
      metadata: { type, usedLearningMemory: Boolean(learningContext) },
    });
    await recordContinuousLearningEvent({
      userId,
      action: "ai_summary",
      stage: "summary",
      entityType: "DASHBOARD",
      entityId: userId,
      ok: false,
      metadata: {
        type,
        error: (error as Error).message,
        usedLearningMemory: Boolean(learningContext),
      },
    });
    return NextResponse.json(
      {
        error: "Помилка звернення до AI",
        message: (error as Error).message,
      },
      { status: 502 },
    );
  }
}
