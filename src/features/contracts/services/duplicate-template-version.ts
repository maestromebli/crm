import type { PrismaClient } from "@prisma/client";

export async function duplicateTemplateVersion(input: {
  prisma: PrismaClient;
  templateId: string;
  actorId?: string;
}) {
  const template = await input.prisma.enverContractTemplate.findUnique({
    where: { id: input.templateId },
  });
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  const latest = await input.prisma.enverContractTemplate.findFirst({
    where: { code: template.code },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? template.version) + 1;

  return input.prisma.enverContractTemplate.create({
    data: {
      code: template.code,
      name: template.name,
      documentType: template.documentType,
      language: template.language,
      version: nextVersion,
      status: "DRAFT",
      bodyHtml: template.bodyHtml,
      bodyDocxTemplateUrl: template.bodyDocxTemplateUrl,
      variablesSchemaJson: template.variablesSchemaJson,
      settingsJson: template.settingsJson,
      approvalRequired: template.approvalRequired,
      createdById: input.actorId,
      updatedById: input.actorId,
    },
  });
}
