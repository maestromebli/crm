import type { PrismaClient } from "@prisma/client";

export async function resendSignLink(input: {
  prisma: PrismaClient;
  contractId: string;
  actorId?: string;
}) {
  const session = await input.prisma.enverSigningSession.findFirst({
    where: { contractId: input.contractId },
    orderBy: { createdAt: "desc" },
  });
  if (!session) throw new Error("SIGNING_SESSION_NOT_FOUND");

  await input.prisma.enverContractAuditEvent.create({
    data: {
      contractId: input.contractId,
      eventType: "SIGN_LINK_RESENT",
      actorId: input.actorId,
      actorType: "USER",
      metadataJson: { sessionId: session.id, provider: session.provider },
    },
  });

  return { ok: true, sessionId: session.id };
}
