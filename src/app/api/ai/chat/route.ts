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
  };
  errorText?: string;
}> {
  const { apiKey, baseUrl, model, messages, toolChoice, includeTools } =
    params;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.45,
    max_tokens: 2400,
  };

  if (includeTools) {
    body.tools = AI_CHAT_TOOLS;
    body.tool_choice = toolChoice;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, status: response.status, errorText: text };
  }

  const data = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: ApiToolCall[];
      };
    }[];
  };
  return { ok: true, status: response.status, data };
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
  const systemContent = memory
    ? `${accessNarrative}\n\n${memory}`
    : accessNarrative;

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
        return NextResponse.json(
          {
            error: `Помилка AI (${result.status})`,
            detail: result.errorText?.slice(0, 500),
          },
          { status: 502 },
        );
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
      },
    });

    return NextResponse.json({
      text: lastAssistantText,
      toolsUsed: [...new Set(toolsUsed)],
    });
  } catch (error) {
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
