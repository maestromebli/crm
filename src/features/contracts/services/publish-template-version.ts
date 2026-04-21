import type { PrismaClient } from "@prisma/client";

export async function publishTemplateVersion(input: {
  prisma: PrismaClient;
  templateId: string;
  actorId?: string;
}) {
  const template = await input.prisma.enverContractTemplate.findUnique({
    where: { id: input.templateId },
  });
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");
  if (!template.bodyHtml) throw new Error("TEMPLATE_BODY_MISSING");

  await input.prisma.enverContractTemplate.updateMany({
    where: { code: template.code, status: "PUBLISHED" },
    data: { isActive: false, status: "ARCHIVED" },
  });

  return input.prisma.enverContractTemplate.update({
    where: { id: template.id },
    data: {
      status: "PUBLISHED",
      isActive: true,
      updatedById: input.actorId,
    },
  });
}
