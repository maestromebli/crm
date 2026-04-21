import type { PrismaClient } from "@prisma/client";
import { getSignatureProvider } from "../providers/signature/signature-provider.factory";

export async function cancelSigningSession(input: {
  prisma: PrismaClient;
  contractId: string;
  actorId?: string;
}) {
  const session = await input.prisma.enverSigningSession.findFirst({
    where: { contractId: input.contractId },
    orderBy: { createdAt: "desc" },
  });
  if (!session?.providerEnvelopeId) {
    throw new Error("ACTIVE_PROVIDER_SESSION_NOT_FOUND");
  }

  await getSignatureProvider(session.provider).cancelEnvelope(session.providerEnvelopeId);

  await input.prisma.enverSigningSession.update({
    where: { id: session.id },
    data: { status: "CANCELLED" },
  });

  await input.prisma.enverContract.update({
    where: { id: input.contractId },
    data: {
      status: "VOIDED",
      signatureStatus: "CANCELLED",
      cancelledAt: new Date(),
      auditEvents: {
        create: {
          eventType: "SIGN_SESSION_CANCELLED",
          actorId: input.actorId,
          actorType: "USER",
          metadataJson: { sessionId: session.id, provider: session.provider },
        },
      },
    },
  });

  return { ok: true };
}
