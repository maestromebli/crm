import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../lib/authz/permissions";
import { buildAssistantAccessNarrative } from "../../../../lib/ai/assistant-context";
import {
  buildContinuousLearningBlock,
  recordContinuousLearningEvent,
} from "../../../../lib/ai/continuous-learning";
import { AI_CHAT_TOOLS } from "../../../../lib/ai/tools/definitions";
import { executeAiTool } from "../../../../lib/ai/tools/execute";
import { requireDatabaseUrl } from "../../../../lib/api/route-guards";
import { logAiEvent } from "../../../../lib/ai/log-ai-event";
import { requireAiRateLimit } from "../../../../lib/ai/route-guard";
import {
  estimateCostUsd,
  estimateTokensApproxFromMessages,
  sanitizeAiPayload,
  type AiUsage,
  usageFromProviderResponse,
} from "../../../../lib/ai/safety";
import { evaluateAiTextQuality } from "../../../../lib/ai/evals/quality";
import { requestAiProvider } from "../../../../lib/ai/provider-request";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(12_000),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(48),
});

function canUseAiAssistant(user: {
  permissionKeys: string[];
  realRole: string;
  impersonatorId?: string;
}): boolean {
  const ctx = {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  };
  return (
    hasEffectivePermission(user.permissionKeys, P.DASHBOARD_VIEW, ctx) ||
    hasEffectivePermission(user.permissionKeys, P.LEADS_VIEW, ctx) ||
    hasEffectivePermission(user.permissionKeys, P.NOTIFICATIONS_VIEW, ctx)
  );
}

type ApiToolCall = {
  id: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type ChatMessage = Record<string, unknown>;

const MAX_TOOL_ROUNDS = 6;

function aiTimeoutMs(): number {
  const raw = Number.parseInt(process.env.AI_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(raw)) return 25_000;
  return Math.max(1_000, Math.min(120_000, raw));
}

async function callChatCompletion(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  toolChoice: "auto" | "none";
  includeTools: boolean;
}): Promise<{
  ok: boolean;
  status: number;
  data?: {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: ApiToolCall[];
      };
    }[];
    usage?: Record<string, unknown>;
  };
  usage?: AiUsage | null;
  tokensApprox?: number;
  costUsdApprox?: number | null;
  errorText?: string;
}> {
  const { apiKey, baseUrl, model, messages, toolChoice, includeTools } =
    params;

  const body: Record<string, unknown> = {
    model,
    messages: messages.map((msg) => sanitizeAiPayload(msg)),
    temperature: 0.45,
    max_tokens: 2400,
  };

  if (includeTools) {
    body.tools = AI_CHAT_TOOLS;
    body.tool_choice = toolChoice;
  }

  const providerResult = await requestAiProvider({
    url: `${baseUrl}/chat/completions`,
    apiKey,
    timeoutMs: aiTimeoutMs(),
    maxRetries: 2,
    retryBaseDelayMs: 350,
    body,
  });

  if (!("response" in providerResult)) {
    return {
      ok: false,
      status: providerResult.status,
      errorText: providerResult.errorText,
    };
  }

  const data = (await providerResult.response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: ApiToolCall[];
      };
    }[];
  };
  const usage = usageFromProviderResponse(data);
  const tokensApprox =
    usage?.totalTokens ??
    estimateTokensApproxFromMessages(
      (body.messages as ChatMessage[]).map((m) => ({
        content: (m as { content?: unknown }).content,
      })),
    );
  const costUsdApprox = estimateCostUsd(model, usage);
  return {
    ok: true,
    status: providerResult.response.status,
    data,
    usage,
    tokensApprox,
    costUsdApprox,
  };
}

function lastMessageIsTool(messages: ChatMessage[]): boolean {
  const last = messages[messages.length - 1];
  return last?.role === "tool";
}

/**
 * Діалог з помічником: tool-calling до CRM (Prisma) у межах прав і owner-scope.
 */
export async function POST(request: Request) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  if (!canUseAiAssistant(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

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

  const limited = await requireAiRateLimit({
    userId: user.id,
    action: "ai_chat_dialogue",
    maxRequests: 30,
    windowMinutes: 10,
  });
  if (limited) return limited;

  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI не налаштований: додайте AI_API_KEY у змінні середовища та перезапустіть сервер.",
      },
      { status: 503 },
    );
  }

  const accessNarrative = await buildAssistantAccessNarrative(user);
  const memory = await buildContinuousLearningBlock({
    userId: user.id,
    take: 14,
  });
  const fullContextDirective =
    "Перед формуванням відповіді спочатку виклич tool `crm_full_context` (мінімум 1 раз у діалозі) і спирайся на отримані дані CRM. Якщо даних не вистачає — викликай профільні tools.";
  const systemContent = memory
    ? `${accessNarrative}\n\n${memory}\n\n${fullContextDirective}`
    : `${accessNarrative}\n\n${fullContextDirective}`;

  const apiMessages: ChatMessage[] = [
    {
      role: "system",
      content: systemContent,
    },
    ...parsed.data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const toolsUsed: string[] = [];

  try {
    let lastAssistantText = "";
    let rounds = 0;
    const usageTotal: AiUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    let tokensApproxTotal = 0;
    let costUsdTotal = 0;
    let hasCostData = false;

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds += 1;

      const result = await callChatCompletion({
        apiKey,
        baseUrl,
        model,
        messages: apiMessages,
        toolChoice: "auto",
        includeTools: true,
      });

      if (!result.ok || !result.data) {
        await logAiEvent({
          userId: user.id,
          action: "ai_chat_dialogue",
          model,
          ok: false,
          errorMessage:
            result.errorText?.slice(0, 500) ?? `Помилка AI (${result.status})`,
          metadata: {
            phase: "chat_completion",
            rounds,
            status: result.status,
            toolsUsed: [...new Set(toolsUsed)],
          },
        });
        return NextResponse.json(
          {
            error: `Помилка AI (${result.status})`,
            detail: result.errorText?.slice(0, 500),
          },
          { status: 502 },
        );
      }

      usageTotal.promptTokens += result.usage?.promptTokens ?? 0;
      usageTotal.completionTokens += result.usage?.completionTokens ?? 0;
      usageTotal.totalTokens += result.usage?.totalTokens ?? 0;
      tokensApproxTotal += result.tokensApprox ?? 0;
      if (typeof result.costUsdApprox === "number") {
        costUsdTotal += result.costUsdApprox;
        hasCostData = true;
      }

      const message = result.data.choices?.[0]?.message;
      const toolCalls = message?.tool_calls;

      if (!toolCalls?.length) {
        lastAssistantText =
          message?.content?.trim() ??
          "Не вдалося отримати відповідь від моделі.";
        break;
      }

      const assistantPayload: ChatMessage = {
        role: "assistant",
        content: message?.content ?? null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function?.name ?? "",
            arguments: tc.function?.arguments ?? "{}",
          },
        })),
      };
      apiMessages.push(assistantPayload);

      for (const tc of toolCalls) {
        const fnName = tc.function?.name ?? "";
        if (fnName) toolsUsed.push(fnName);
        const fnArgs = tc.function?.arguments ?? "{}";
        const toolResult = await executeAiTool(fnName, fnArgs, user);
        apiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult,
        });
      }
    }

    if (lastAssistantText === "" && lastMessageIsTool(apiMessages)) {
      const finalized = await callChatCompletion({
        apiKey,
        baseUrl,
        model,
        messages: apiMessages,
        toolChoice: "none",
        includeTools: true,
      });

      if (finalized.ok && finalized.data) {
        usageTotal.promptTokens += finalized.usage?.promptTokens ?? 0;
        usageTotal.completionTokens += finalized.usage?.completionTokens ?? 0;
        usageTotal.totalTokens += finalized.usage?.totalTokens ?? 0;
        tokensApproxTotal += finalized.tokensApprox ?? 0;
        if (typeof finalized.costUsdApprox === "number") {
          costUsdTotal += finalized.costUsdApprox;
          hasCostData = true;
        }
        const msg = finalized.data.choices?.[0]?.message;
        lastAssistantText =
          msg?.content?.trim() ??
          "Не вдалося сформувати відповідь після даних CRM.";
      } else {
        lastAssistantText =
          "Занадто багато кроків із інструментами або помилка моделі. Спростіть запит.";
      }
    } else if (rounds >= MAX_TOOL_ROUNDS && lastAssistantText === "") {
      lastAssistantText =
        "Занадто багато кроків із інструментами. Спростіть запит або розбийте його на частини.";
    }

    await recordContinuousLearningEvent({
      userId: user.id,
      action: "ai_chat_dialogue",
      stage: "chat",
      ok: true,
      metadata: {
        rounds,
        toolsUsed: [...new Set(toolsUsed)],
        usedLearningMemory: Boolean(memory),
        promptTokens: usageTotal.promptTokens,
        completionTokens: usageTotal.completionTokens,
        totalTokens: usageTotal.totalTokens,
        tokensApprox: tokensApproxTotal,
        costUsdApprox: hasCostData ? Number(costUsdTotal.toFixed(6)) : null,
        qualityScore: evaluateAiTextQuality({
          text: lastAssistantText,
          maxSentences: 8,
          minChars: 12,
          requireUkrainian: true,
          allowMarkdown: false,
        }).score,
      },
    });

    const quality = evaluateAiTextQuality({
      text: lastAssistantText,
      maxSentences: 8,
      minChars: 12,
      requireUkrainian: true,
      allowMarkdown: false,
    });

    await logAiEvent({
      userId: user.id,
      action: "ai_chat_dialogue",
      model,
      ok: true,
      tokensApprox:
        usageTotal.totalTokens > 0 ? usageTotal.totalTokens : tokensApproxTotal,
      metadata: {
        rounds,
        toolsUsed: [...new Set(toolsUsed)],
        promptTokens: usageTotal.promptTokens,
        completionTokens: usageTotal.completionTokens,
        totalTokens: usageTotal.totalTokens,
        tokensApprox: tokensApproxTotal,
        costUsdApprox: hasCostData ? Number(costUsdTotal.toFixed(6)) : null,
        qualityScore: quality.score,
        qualityViolations: quality.violations,
      },
    });

    return NextResponse.json({
      text: lastAssistantText,
      toolsUsed: [...new Set(toolsUsed)],
      quality,
    });
  } catch (error) {
    await logAiEvent({
      userId: user.id,
      action: "ai_chat_dialogue",
      model,
      ok: false,
      errorMessage: (error as Error).message,
      metadata: {
        usedLearningMemory: Boolean(memory),
      },
    });
    await recordContinuousLearningEvent({
      userId: user.id,
      action: "ai_chat_dialogue",
      stage: "chat",
      ok: false,
      metadata: {
        error: (error as Error).message,
        usedLearningMemory: Boolean(memory),
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
