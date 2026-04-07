import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const rules = await prisma.automationRule.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      trigger: true,
      enabled: true,
      graphJson: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ flows: rules });
}

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

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
  if (!o) return NextResponse.json({ error: "Очікується об'єкт" }, { status: 400 });

  const name = typeof o.name === "string" ? o.name.trim() : "";
  const trigger = typeof o.trigger === "string" ? o.trigger.trim() : "";
  if (!name || !trigger) {
    return NextResponse.json({ error: "Потрібні поля name і trigger" }, { status: 400 });
  }

  const created = await prisma.automationRule.create({
    data: {
      name,
      trigger,
      enabled: o.enabled === false ? false : true,
      graphJson:
        o.graphJson && typeof o.graphJson === "object" ? (o.graphJson as object) : {},
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
