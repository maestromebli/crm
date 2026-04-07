import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { prisma } from "../../../../../lib/prisma";

type Ctx = { params: Promise<{ leadId: string }> };

const MAX_BODY = 8000;

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessLeadAccess(user, P.LEADS_VIEW, lead);
    if (denied) return denied;

    const rows = await prisma.leadMessage.findMany({
      where: { leadId },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        body: true,
        channel: true,
        interactionKind: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        body: r.body,
        channel: r.channel,
        interactionKind: r.interactionKind,
        createdAt: r.createdAt.toISOString(),
        author: r.createdBy.name ?? r.createdBy.email,
      })),
    });
  } catch (e) {
     
    console.error("[GET leads/[leadId]/messages]", e);
    return NextResponse.json(
      { error: "Помилка завантаження" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;

  let body: { body?: string; channel?: string; interactionKind?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const text =
    typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Введіть текст повідомлення" }, {
      status: 400,
    });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: "Текст завеликий" }, { status: 400 });
  }

  const channel =
    typeof body.channel === "string" && body.channel.trim()
      ? body.channel.trim().slice(0, 32)
      : "INTERNAL";

  const ALLOWED_KIND = new Set(["CALL", "MESSAGE", "NOTE", "COMMENT"]);
  let interactionKind = "NOTE";
  if (typeof body.interactionKind === "string" && body.interactionKind.trim()) {
    const k = body.interactionKind.trim().toUpperCase();
    if (ALLOWED_KIND.has(k)) interactionKind = k;
  }
  const channelResolved =
    interactionKind === "CALL" ? "PHONE" : channel;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
    if (denied) return denied;

    const row = await prisma.leadMessage.create({
      data: {
        leadId,
        body: text,
        channel: channelResolved,
        interactionKind,
        createdById: user.id,
      },
    });

    const authorRow = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true },
    });
    const author =
      authorRow?.name?.trim() || authorRow?.email || "Користувач";

    await appendActivityLog({
      entityType: "LEAD",
      entityId: leadId,
      type: "LEAD_UPDATED",
      actorUserId: user.id,
      data: { note: "lead_message", messageId: row.id },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { lastActivityAt: new Date() },
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/messages`);
    revalidatePath(`/leads/${leadId}/activity`);

    return NextResponse.json({
      ok: true,
      message: {
        id: row.id,
        body: row.body,
        channel: row.channel,
        interactionKind: row.interactionKind,
        createdAt: row.createdAt.toISOString(),
        author,
      },
    });
  } catch (e) {
     
    console.error("[POST leads/[leadId]/messages]", e);
    return NextResponse.json({ error: "Помилка збереження" }, {
      status: 500,
    });
  }
}
