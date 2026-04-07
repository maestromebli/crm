import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyClientPortalToken } from "@/lib/client-portal/token";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const payload = verifyClientPortalToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const rows = await prisma.activityLog.findMany({
    where: { entityType: "DEAL", entityId: payload.dealId, type: "DEAL_UPDATED" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, data: true, createdAt: true },
  });
  const messages = rows
    .map((row) => {
      const data =
        row.data && typeof row.data === "object" && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : {};
      if (data.kind !== "client_message") return null;
      return {
        id: row.id,
        body: typeof data.body === "string" ? data.body : "",
        createdAt: row.createdAt.toISOString(),
      };
    })
    .filter((x): x is { id: string; body: string; createdAt: string } => Boolean(x));
  return NextResponse.json({ messages });
}

export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const payload = verifyClientPortalToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const o =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const text = typeof o?.message === "string" ? o.message.trim() : "";
  if (!text) return NextResponse.json({ error: "message is required" }, { status: 400 });

  await prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: payload.dealId,
      type: "DEAL_UPDATED",
      source: "INTEGRATION",
      data: {
        kind: "client_message",
        body: text,
      },
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
