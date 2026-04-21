import { NextRequest, NextResponse } from "next/server";
import { contractTemplateSchema } from "@/features/contracts/schemas/contract-template.schema";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const items = await prisma.enverContractTemplate.findMany({
    orderBy: [{ code: "asc" }, { version: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const body = await req.json();
  const parsed = contractTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const latest = await prisma.enverContractTemplate.findFirst({
    where: { code: parsed.data.code },
    orderBy: { version: "desc" },
  });

  const created = await prisma.enverContractTemplate.create({
    data: {
      ...parsed.data,
      bodyDocxTemplateUrl: parsed.data.bodyDocxTemplateUrl || null,
      version: (latest?.version ?? 0) + 1,
      status: "DRAFT",
    },
  });
  return NextResponse.json(created, { status: 201 });
}
