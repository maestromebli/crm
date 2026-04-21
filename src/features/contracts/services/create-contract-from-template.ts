import type { Prisma, PrismaClient } from "@prisma/client";
import { buildContractPayload } from "./build-contract-payload";

export async function createContractFromTemplate(input: {
  prisma: PrismaClient;
  orderId: string;
  templateCode: string;
  actorId?: string;
}) {
  const template = await input.prisma.enverContractTemplate.findFirst({
    where: { code: input.templateCode, status: "PUBLISHED", isActive: true },
    orderBy: { version: "desc" },
  });
  if (!template) throw new Error("PUBLISHED_TEMPLATE_NOT_FOUND");

  const order = await input.prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!order.clientId) throw new Error("ORDER_CLIENT_MISSING");

  const client = await input.prisma.client.findUnique({
    where: { id: String(order.clientId) },
  });
  if (!client) throw new Error("CLIENT_NOT_FOUND");

  const companySettings = await input.prisma.enverContractSetting.findUnique({
    where: { key: "company_legal_defaults" },
  });
  const company = (companySettings?.valueJson ?? {}) as Record<string, unknown>;

  const payload = buildContractPayload({
    order: order as unknown as Record<string, unknown>,
    client: client as unknown as Record<string, unknown>,
    company,
  });

  const contractNumber = `CNT-${Date.now()}`;
  return input.prisma.enverContract.create({
    data: {
      contractNumber,
      orderId: input.orderId,
      dealId: order.dealId ?? null,
      clientId: String(order.clientId),
      templateId: template.id,
      templateCode: template.code,
      templateVersion: template.version,
      status: "DRAFT",
      signatureStatus: "NOT_STARTED",
      payloadJson: payload as Prisma.InputJsonValue,
      createdById: input.actorId,
      updatedById: input.actorId,
      parties: {
        create: [
          {
            role: "CUSTOMER",
            partyType: "INDIVIDUAL",
            fullName: String((client as { name?: string }).name ?? "Клієнт"),
            email: String((client as { email?: string }).email ?? ""),
            phone: String((client as { phone?: string }).phone ?? ""),
            signOrder: 1,
          },
        ],
      },
      auditEvents: {
        create: {
          eventType: "CONTRACT_CREATED",
          actorId: input.actorId,
          actorType: "USER",
          metadataJson: { templateId: template.id, templateVersion: template.version },
        },
      },
    },
    include: { parties: true },
  });
}
