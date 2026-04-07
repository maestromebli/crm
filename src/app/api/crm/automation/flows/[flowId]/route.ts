import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

type Ctx = { params: Promise<{ flowId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const { flowId } = await ctx.params;
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

  await prisma.automationRule.update({
    where: { id: flowId },
    data: {
      name: typeof o.name === "string" ? o.name.trim() : undefined,
      trigger: typeof o.trigger === "string" ? o.trigger.trim() : undefined,
      enabled: typeof o.enabled === "boolean" ? o.enabled : undefined,
      graphJson:
        o.graphJson && typeof o.graphJson === "object"
          ? (o.graphJson as object)
          : undefined,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;
  const { flowId } = await ctx.params;
  await prisma.automationRule.delete({ where: { id: flowId } });
  return NextResponse.json({ ok: true });
}
