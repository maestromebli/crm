import type {
  CreateEnvelopeInput,
  CreateEnvelopeResult,
  EnvelopeStatusResult,
  SignatureProviderAdapter,
  SignedArtifactsResult,
  VerifyArtifactsInput,
  VerifyArtifactsResult,
} from "./signature-provider.types";

export class PaperlessSignatureAdapter implements SignatureProviderAdapter {
  async createEnvelope(_input: CreateEnvelopeInput): Promise<CreateEnvelopeResult> {
    throw new Error("PaperlessSignatureAdapter scaffold only.");
  }

  async getEnvelopeStatus(_providerEnvelopeId: string): Promise<EnvelopeStatusResult> {
    throw new Error("PaperlessSignatureAdapter scaffold only.");
  }

  async cancelEnvelope(_providerEnvelopeId: string): Promise<void> {
    throw new Error("PaperlessSignatureAdapter scaffold only.");
  }

  async downloadSignedFiles(_providerEnvelopeId: string): Promise<SignedArtifactsResult> {
    throw new Error("PaperlessSignatureAdapter scaffold only.");
  }

  async verifyArtifacts(_input: VerifyArtifactsInput): Promise<VerifyArtifactsResult> {
    throw new Error("PaperlessSignatureAdapter scaffold only.");
  }
}
