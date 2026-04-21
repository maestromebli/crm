import type { PrismaClient } from "@prisma/client";
import { getSignatureProvider } from "../providers/signature/signature-provider.factory";

export async function verifySignedContract(input: {
  prisma: PrismaClient;
  contractId: string;
}) {
  const contract = await input.prisma.enverContract.findUnique({
    where: { id: input.contractId },
    include: {
      sessions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!contract?.provider) throw new Error("CONTRACT_PROVIDER_MISSING");
  const latestSession = contract.sessions[0];
  if (!latestSession?.providerEnvelopeId) throw new Error("PROVIDER_ENVELOPE_MISSING");

  const provider = getSignatureProvider(contract.provider);
  const artifacts = await provider.downloadSignedFiles(latestSession.providerEnvelopeId);
  const verification = await provider.verifyArtifacts({
    signedDocumentUrl: artifacts.signedDocumentUrl,
    signatureContainerUrl: artifacts.signatureContainerUrl,
  });

  await input.prisma.enverSignatureArtifact.create({
    data: {
      contractId: contract.id,
      provider: contract.provider,
      signatureType: "QES",
      signedDocumentUrl: artifacts.signedDocumentUrl,
      signatureContainerUrl: artifacts.signatureContainerUrl,
      verificationResultJson: verification.details as object,
      certificateInfoJson: (artifacts.certificateInfo ?? undefined) as object | undefined,
    },
  });

  await input.prisma.enverContractAuditEvent.create({
    data: {
      contractId: contract.id,
      eventType: "SIGNATURE_VERIFIED",
      metadataJson: { isValid: verification.isValid },
    },
  });

  return verification;
}
