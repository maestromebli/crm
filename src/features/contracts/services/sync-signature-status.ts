import type { EnverSignatureStatus, PrismaClient } from "@prisma/client";
import { verifySignedContract } from "./verify-signed-contract";

export async function syncSignatureStatus(input: {
  prisma: PrismaClient;
  provider: string;
  envelopeId: string;
  normalizedStatus: EnverSignatureStatus;
  rawPayload: unknown;
}) {
  const session = await input.prisma.enverSigningSession.findFirst({
    where: {
      provider: input.provider as "VCHASNO" | "DIIA" | "PAPERLESS",
      providerEnvelopeId: input.envelopeId,
    },
    include: { contract: true },
  });
  if (!session) return { ignored: true, reason: "SESSION_NOT_FOUND" };
  if (session.status === input.normalizedStatus) {
    return { ignored: true, reason: "DUPLICATE_STATUS" };
  }

  await input.prisma.enverSigningSession.update({
    where: { id: session.id },
    data: {
      status: input.normalizedStatus,
      lastWebhookAt: new Date(),
      providerPayloadJson: input.rawPayload as object,
    },
  });

  const contractStatus = mapSignatureToContractStatus(input.normalizedStatus);
  await input.prisma.enverContract.update({
    where: { id: session.contractId },
    data: {
      signatureStatus: input.normalizedStatus,
      ...(contractStatus ? { status: contractStatus } : {}),
      ...(input.normalizedStatus === "SIGNED" ? { signedAt: new Date() } : {}),
    },
  });

  await input.prisma.enverContractAuditEvent.create({
    data: {
      contractId: session.contractId,
      eventType: `SIGNATURE_STATUS_${input.normalizedStatus}`,
      metadataJson: input.rawPayload as object,
    },
  });

  if (input.normalizedStatus === "SIGNED") {
    await verifySignedContract({ prisma: input.prisma, contractId: session.contractId });
  }

  return { ignored: false };
}

function mapSignatureToContractStatus(status: EnverSignatureStatus) {
  switch (status) {
    case "SIGNED":
      return "SIGNED" as const;
    case "EXPIRED":
      return "EXPIRED" as const;
    case "CANCELLED":
    case "FAILED":
      return "VOIDED" as const;
    case "OPENED":
    case "IDENTIFIED":
    case "SIGNING_IN_PROGRESS":
      return "PARTIALLY_SIGNED" as const;
    case "LINK_SENT":
      return "SENT_FOR_SIGNATURE" as const;
    default:
      return undefined;
  }
}
