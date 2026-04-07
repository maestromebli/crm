import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";

function uniq(ids: string[]): string[] {
  return [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
}

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.USERS_VIEW);
  if (denied) return denied;

  const heads = await prisma.user.findMany({
    where: { role: "HEAD_MANAGER" },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });
  const managers = await prisma.user.findMany({
    where: { role: { in: ["SALES_MANAGER", "USER"] } },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true, role: true, headManagerId: true },
  });
  const map: Record<string, string[]> = {};
  for (const m of managers) {
    if (!m.headManagerId) continue;
    if (!map[m.headManagerId]) map[m.headManagerId] = [];
    map[m.headManagerId].push(m.id);
  }

  const visibleHeads =
    user.role === "HEAD_MANAGER" ? heads.filter((h) => h.id === user.id) : heads;

  return NextResponse.json({
    headManagers: visibleHeads,
    managers,
    assignments: map,
  });
}

export async function PATCH(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.USERS_MANAGE);
  if (denied) return denied;

  let body: { headManagerId?: string; memberIds?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const headManagerId = (body.headManagerId ?? "").trim();
  const memberIds = uniq(Array.isArray(body.memberIds) ? body.memberIds : []);
  if (!headManagerId) {
    return NextResponse.json({ error: "headManagerId обов'язковий" }, { status: 400 });
  }

  const [head, members] = await Promise.all([
    prisma.user.findUnique({
      where: { id: headManagerId },
      select: { id: true, role: true },
    }),
    prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, role: true },
    }),
  ]);

  if (!head || head.role !== "HEAD_MANAGER") {
    return NextResponse.json({ error: "Некоректний headManagerId" }, { status: 400 });
  }
  if (members.some((m) => m.role !== "SALES_MANAGER" && m.role !== "USER")) {
    return NextResponse.json(
      { error: "У підлеглих дозволені лише SALES_MANAGER або USER" },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.user.updateMany({
      where: {
        headManagerId,
        role: { in: ["SALES_MANAGER", "USER"] },
        id: { notIn: memberIds.length ? memberIds : ["__none__"] },
      },
      data: { headManagerId: null },
    }),
    prisma.user.updateMany({
      where: {
        id: { in: memberIds.length ? memberIds : ["__none__"] },
        role: { in: ["SALES_MANAGER", "USER"] },
      },
      data: { headManagerId },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
