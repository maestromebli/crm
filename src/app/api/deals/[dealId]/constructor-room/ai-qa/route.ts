import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { requireAiRateLimit } from "../../../../../../lib/ai/route-guard";
import { openAiChatCompletionText } from "../../../../../../features/ai/core/openai-client";
import { logAiEvent } from "../../../../../../lib/ai/log-ai-event";

export const runtime = "nodejs";

const bodySchema = z.object({
  transcript: z.string().min(1).max(100_000),
  /** Зберегти результат у `aiQaJson` кімнати */
  saveToRoom: z.boolean().optional(),
});

type Ctx = { params: Promise<{ dealId: string }> };

function parseJsonItems(raw: string): { question: string; answer: string }[] {
  const trimmed = raw.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) {
      parsed = JSON.parse(m[0]) as unknown;
    } else {
      throw new Error("INVALID_JSON");
    }
  }
  if (Array.isArray(parsed)) {
    return parsed.map((row) => {
      const o = row as { question?: string; answer?: string; q?: string; a?: string };
      return {
        question: String(o.question ?? o.q ?? "").trim(),
        answer: String(o.answer ?? o.a ?? "").trim(),
      };
    });
  }
  if (parsed && typeof parsed === "object" && "items" in parsed) {
    const items = (parsed as { items: unknown }).items;
    if (Array.isArray(items)) {
      return items.map((row) => {
        const o = row as { question?: string; answer?: string };
        return {
          question: String(o.question ?? "").trim(),
          answer: String(o.answer ?? "").trim(),
        };
      });
    }
  }
  return [];
}

/**
 * З тексту переписки (Telegram тощо) формує масив пар питання-відповідь через AI.
 */
export async function POST(req: Request, ctx: Ctx) {
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
    action: "constructor_room_ai_qa",
    maxRequests: 20,
    windowMinutes: 10,
  });
  if (limited) return limited;

  const { dealId } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
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

  const { transcript, saveToRoom } = parsed.data;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.PRODUCTION_LAUNCH, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const room = await prisma.dealConstructorRoom.findUnique({
      where: { dealId },
      select: { id: true },
    });
    if (!room) {
      return NextResponse.json(
        { error: "Спочатку створіть кімнату конструктора" },
        { status: 404 },
      );
    }

    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL ?? "gpt-4.1-mini";

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "AI не налаштований: задайте AI_API_KEY у змінних середовища.",
        },
        { status: 503 },
      );
    }

    const system = `Ти допомагаєш меблевій CRM ENVER. Користувач вставляє текст переписки (часто Telegram) щодо проєкту. Витягни змістовні пари «питання / уточнення → відповідь / рішення». Ігноруй привітання та сміття. Поверни СТРОГО один JSON-об'єкт без markdown: {"items":[{"question":"...","answer":"..."}]}. Українською. Якщо пар немає — {"items":[]}.`;

    const response = await openAiChatCompletionText({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Текст переписки:\n\n${transcript}`,
        },
      ],
      temperature: 0.25,
      maxTokens: 4096,
    });

    if (response.ok === false) {
      await logAiEvent({
        userId: user.id,
        action: "constructor_room_ai_qa",
        model,
        ok: false,
        errorMessage: response.error,
        entityType: "DEAL",
        entityId: dealId,
      });
      return NextResponse.json(
        {
          error: `Помилка AI (${response.httpStatus ?? 502})`,
          detail: response.error.slice(0, 400),
        },
        { status: 502 },
      );
    }

    const content = response.content ?? "{}";
    const items = parseJsonItems(content);

    if (saveToRoom) {
      await prisma.dealConstructorRoom.update({
        where: { dealId },
        data: { aiQaJson: items },
      });
    }

    await logAiEvent({
      userId: user.id,
      action: "constructor_room_ai_qa",
      model: response.model,
      ok: true,
      tokensApprox:
        response.usage?.totalTokens && response.usage.totalTokens > 0
          ? response.usage.totalTokens
          : response.tokensApprox,
      entityType: "DEAL",
      entityId: dealId,
      metadata: {
        saved: Boolean(saveToRoom),
        itemsCount: items.length,
        promptTokens: response.usage?.promptTokens ?? 0,
        completionTokens: response.usage?.completionTokens ?? 0,
        totalTokens: response.usage?.totalTokens ?? 0,
        tokensApprox: response.tokensApprox,
        costUsdApprox: response.costUsdApprox,
      },
    });

    return NextResponse.json({ items, saved: Boolean(saveToRoom) });
  } catch (e) {
    console.error("[POST constructor-room/ai-qa]", e);
    if (e instanceof Error && e.message === "INVALID_JSON") {
      return NextResponse.json(
        { error: "Не вдалося розібрати відповідь AI" },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Помилка сервера" }, { status: 500 });
  }
}
