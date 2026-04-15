import { NextResponse } from "next/server";
import { z } from "zod";
import { forbidUnlessPermission, requireSessionUser } from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { prisma } from "../../../../../lib/prisma";
import {
  buildContinuousLearningBlock,
  buildLearningKnowledgeBlock,
  recordContinuousLearningEvent,
} from "../../../../../lib/ai/continuous-learning";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(12000),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(48),
});

type ChatMessage = Record<string, unknown>;

async function buildAdminSystemSnapshot(): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    leadsAll,
    leadsNoDeal,
    dealsOpen,
    tasksOpen,
    tasksOverdue,
    aiErrors7d,
    aiCalls7d,
    proposalsDraft,
    estimatesDraft,
    productionBlocked,
    unreadInboxThreads,
    materialCatalogItems,
    topFurnitureLines,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { dealId: null } }),
    prisma.deal.count({ where: { status: "OPEN" } }),
    prisma.task.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.task.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        dueAt: { lt: now },
      },
    }),
    prisma.aiAssistantLog.count({
      where: { ok: false, createdAt: { gte: weekAgo } },
    }),
    prisma.aiAssistantLog.count({
      where: { createdAt: { gte: weekAgo } },
    }),
    prisma.leadProposal.count({ where: { status: "DRAFT" } }),
    prisma.estimate.count({ where: { status: "DRAFT" } }),
    prisma.productionFlow.count({
      where: { status: { in: ["BLOCKED", "ON_HOLD"] } },
    }),
    prisma.commThread.count({ where: { unreadCount: { gt: 0 } } }),
    prisma.materialCatalogItem.count(),
    prisma.estimateLineItem.findMany({
      where: {
        salePrice: { gt: 0 },
        productName: { not: "" },
        type: { in: ["PRODUCT", "MATERIAL", "FITTING", "WORK", "SERVICE"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: {
        productName: true,
        salePrice: true,
      },
    }),
  ]);

  const topFurnitureMap = new Map<string, { count: number; sum: number }>();
  for (const row of topFurnitureLines) {
    const key = row.productName.trim().toLowerCase();
    if (!key) continue;
    const current = topFurnitureMap.get(key) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += row.salePrice;
    topFurnitureMap.set(key, current);
  }
  const topFurniture = Array.from(topFurnitureMap.entries())
    .map(([name, v]) => ({
      name,
      count: v.count,
      avg: Math.round((v.sum / v.count) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((x) => `${x.name} (~${x.avg}, n=${x.count})`)
    .join("; ");

  return [
    "CRM health snapshot:",
    `- leads_all: ${leadsAll}`,
    `- leads_without_deal: ${leadsNoDeal}`,
    `- deals_open: ${dealsOpen}`,
    `- tasks_open: ${tasksOpen}`,
    `- tasks_overdue: ${tasksOverdue}`,
    `- proposals_draft: ${proposalsDraft}`,
    `- estimates_draft: ${estimatesDraft}`,
    `- production_blocked_or_on_hold: ${productionBlocked}`,
    `- inbox_threads_unread: ${unreadInboxThreads}`,
    `- material_catalog_items: ${materialCatalogItems}`,
    `- ai_calls_7d: ${aiCalls7d}`,
    `- ai_errors_7d: ${aiErrors7d}`,
    `- top_furniture_positions_recent: ${topFurniture || "n/a"}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

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
    await recordContinuousLearningEvent({
      userId: user.id,
      action: "settings_admin_ai_chat",
      stage: "settings_admin_chat",
      entityType: "SYSTEM",
      entityId: "global",
      ok: false,
      metadata: { reason: "missing_api_key" },
    });
    return NextResponse.json(
      {
        error:
          "AI не налаштований: додайте AI_API_KEY у змінні середовища та перезапустіть сервер.",
      },
      { status: 503 },
    );
  }

  const [snapshot, memory, adminKnowledge] = await Promise.all([
    buildAdminSystemSnapshot(),
    buildContinuousLearningBlock({
      userId: user.id,
      entityType: "SYSTEM",
      entityId: "global",
      take: 20,
    }),
    buildLearningKnowledgeBlock({
      userId: user.id,
      entityType: "SYSTEM",
      entityId: "global",
      take: 20,
    }),
  ]);

  const systemPrompt = [
    "You are ENVER CRM Admin AI Architect.",
    "Answer in Ukrainian or Russian according to user language.",
    "Your role: propose practical CRM improvements with priorities, expected impact, risks, and implementation steps.",
    "Always give concrete actions, recommended prompts, and process/system changes.",
    "When relevant, structure response as: 1) diagnosis, 2) quick wins, 3) 30/60/90 plan, 4) prompts/templates for team.",
    "Do not expose secrets. Use only provided context.",
    "",
    snapshot,
    memory ? `\n${memory}` : "",
    adminKnowledge ? `\n${adminKnowledge}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const apiMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...parsed.data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: 0.35,
        max_tokens: 1800,
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 600);
      await recordContinuousLearningEvent({
        userId: user.id,
        action: "settings_admin_ai_chat",
        stage: "settings_admin_chat",
        entityType: "SYSTEM",
        entityId: "global",
        ok: false,
        metadata: { httpStatus: response.status, detail },
      });
      return NextResponse.json(
        { error: `Помилка AI (${response.status})`, detail },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text =
      data.choices?.[0]?.message?.content?.trim() ||
      "AI не повернув контент. Спробуйте уточнити запит.";

    await recordContinuousLearningEvent({
      userId: user.id,
      action: "settings_admin_ai_chat",
      stage: "settings_admin_chat",
      entityType: "SYSTEM",
      entityId: "global",
      ok: true,
      metadata: {
        promptMessages: parsed.data.messages.length,
        usedLearningMemory: Boolean(memory),
        usedAdminKnowledge: Boolean(adminKnowledge),
        model,
      },
    });

    return NextResponse.json({ text });
  } catch (error) {
    await recordContinuousLearningEvent({
      userId: user.id,
      action: "settings_admin_ai_chat",
      stage: "settings_admin_chat",
      entityType: "SYSTEM",
      entityId: "global",
      ok: false,
      metadata: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: "Помилка звернення до AI", message: (error as Error).message },
      { status: 502 },
    );
  }
}
