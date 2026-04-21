import type { EnverSignatureProvider, PrismaClient } from "@prisma/client";
import { canSendForSignature } from "../lib/contract-status";
import {
  getSignatureProvider,
  resolveSignatureProvider,
} from "../providers/signature/signature-provider.factory";

export async function sendContractForSignature(input: {
  prisma: PrismaClient;
  contractId: string;
  provider?: EnverSignatureProvider;
  actorId?: string;
}) {
  const contract = await input.prisma.enverContract.findUnique({
    where: { id: input.contractId },
    include: { parties: true },
  });
  if (!contract) throw new Error("CONTRACT_NOT_FOUND");
  if (!canSendForSignature(contract.status)) throw new Error("CONTRACT_MUST_BE_ISSUED");
  if (!contract.renderedPdfUrl) throw new Error("CONTRACT_RENDERED_PDF_MISSING");

  const provider = resolveSignatureProvider(input.provider);
  const adapter = getSignatureProvider(provider);

  const envelope = await adapter.createEnvelope({
    contractId: contract.id,
    title: `Договір ${contract.contractNumber}`,
    pdfUrl: contract.renderedPdfUrl,
    parties: contract.parties.map((party) => ({
      role: party.role,
      fullName: party.fullName,
      email: party.email ?? undefined,
      phone: party.phone ?? undefined,
      signOrder: party.signOrder,
    })),
    callbackUrl: `${process.env.APP_BASE_URL}/api/integrations/signature/${String(provider).toLowerCase()}/webhook`,
    expiresAt: contract.expiresAt?.toISOString(),
  });

  await input.prisma.enverSigningSession.create({
    data: {
      contractId: contract.id,
      provider,
      providerEnvelopeId: envelope.providerEnvelopeId,
      providerSessionId: envelope.providerSessionId,
      startUrl: envelope.startUrl,
      deepLink: envelope.deepLink,
      qrCodeUrl: envelope.qrCodeUrl,
      providerPayloadJson: envelope.raw as object,
      status: "LINK_SENT",
    },
  });

  return input.prisma.enverContract.update({
    where: { id: contract.id },
    data: {
      provider,
      status: "SENT_FOR_SIGNATURE",
      signatureStatus: "LINK_SENT",
      auditEvents: {
        create: {
          eventType: "CONTRACT_SENT_FOR_SIGNATURE",
          actorId: input.actorId,
          actorType: "USER",
          metadataJson: { provider, providerEnvelopeId: envelope.providerEnvelopeId },
        },
      },
    },
  });
}
