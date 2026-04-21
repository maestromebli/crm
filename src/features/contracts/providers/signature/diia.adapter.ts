import type {
  CreateEnvelopeInput,
  CreateEnvelopeResult,
  EnvelopeStatusResult,
  SignatureProviderAdapter,
  SignedArtifactsResult,
  VerifyArtifactsInput,
  VerifyArtifactsResult,
} from "./signature-provider.types";

export class DiiaSignatureAdapter implements SignatureProviderAdapter {
  async createEnvelope(_input: CreateEnvelopeInput): Promise<CreateEnvelopeResult> {
    throw new Error("DiiaSignatureAdapter scaffold only. TODO: implement provider contract.");
  }

  async getEnvelopeStatus(_providerEnvelopeId: string): Promise<EnvelopeStatusResult> {
    throw new Error("DiiaSignatureAdapter scaffold only.");
  }

  async cancelEnvelope(_providerEnvelopeId: string): Promise<void> {
    throw new Error("DiiaSignatureAdapter scaffold only.");
  }

  async downloadSignedFiles(_providerEnvelopeId: string): Promise<SignedArtifactsResult> {
    throw new Error("DiiaSignatureAdapter scaffold only.");
  }

  async verifyArtifacts(_input: VerifyArtifactsInput): Promise<VerifyArtifactsResult> {
    throw new Error("DiiaSignatureAdapter scaffold only.");
  }
}
