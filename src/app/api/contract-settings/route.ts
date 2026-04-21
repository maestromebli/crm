import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const settings = await prisma.enverContractSetting.findMany({
    orderBy: { key: "asc" },
  });
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const body = (await req.json()) as { key?: string; valueJson?: unknown };
  if (!body.key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }
  const updated = await prisma.enverContractSetting.upsert({
    where: { key: body.key },
    update: { valueJson: (body.valueJson ?? {}) as object },
    create: { key: body.key, valueJson: (body.valueJson ?? {}) as object },
  });
  return NextResponse.json(updated);
}
