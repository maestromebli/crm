import { NextRequest, NextResponse } from "next/server";
import { contractTemplateSchema } from "@/features/contracts/schemas/contract-template.schema";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const { id } = await params;
  const item = await prisma.enverContractTemplate.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "TEMPLATE_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const parsed = contractTemplateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await prisma.enverContractTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "TEMPLATE_NOT_FOUND" }, { status: 404 });
  }

  if (template.status === "PUBLISHED") {
    const latest = await prisma.enverContractTemplate.findFirst({
      where: { code: template.code },
      orderBy: { version: "desc" },
    });
    const duplicated = await prisma.enverContractTemplate.create({
      data: {
        code: template.code,
        name: template.name,
        documentType: template.documentType,
        language: template.language,
        version: (latest?.version ?? template.version) + 1,
        status: "DRAFT",
        bodyHtml: template.bodyHtml,
        bodyDocxTemplateUrl: template.bodyDocxTemplateUrl,
        variablesSchemaJson: template.variablesSchemaJson,
        settingsJson: template.settingsJson,
        approvalRequired: template.approvalRequired,
      },
    });
    const updated = await prisma.enverContractTemplate.update({
      where: { id: duplicated.id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  }

  const updated = await prisma.enverContractTemplate.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}
