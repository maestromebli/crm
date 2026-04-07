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
    return runOpenAi(
      `Тип: executive_dashboard (оновлення текстового підсумку для UI).\nКонтекст:\n${trimmed}`,
      type,
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
    return runOpenAi(serverContext, type);
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

  return runOpenAi(
    `Тип: ${type}.\nКонтекст (перевірте на відповідність політиці безпеки):\n${trimmed}`,
    type,
  );
}

async function runOpenAi(contextBlock: string, type: string) {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
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
${contextBlock}`
      : `You are an AI assistant for ENVER CRM (custom furniture CRM for Ukrainian market).
Generate a short Ukrainian summary (max 3 sentences) for UI display.
Context type: ${type}.

Context:
${contextBlock}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Ти помічник ENVER CRM. Пиши українською, стисло, без привітання.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 220,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Помилка AI (${response.status})`,
          text: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content =
      data.choices?.[0]?.message?.content ??
      "AI не надіслав контент. Перевірте модель та ключ.";

    return NextResponse.json({ text: content });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Помилка звернення до AI",
        message: (error as Error).message,
      },
      { status: 502 },
    );
  }
}
