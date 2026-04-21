export interface CreateEnvelopeInput {
  contractId: string;
  title: string;
  pdfUrl: string;
  parties: Array<{
    role: "CUSTOMER" | "COMPANY" | "GUARANTOR";
    fullName: string;
    email?: string;
    phone?: string;
    signOrder: number;
  }>;
  callbackUrl: string;
  expiresAt?: string;
}

export interface CreateEnvelopeResult {
  providerEnvelopeId: string;
  providerSessionId?: string;
  startUrl?: string;
  deepLink?: string;
  qrCodeUrl?: string;
  raw: unknown;
}

export interface EnvelopeStatusResult {
  status:
    | "NOT_STARTED"
    | "LINK_SENT"
    | "OPENED"
    | "IDENTIFIED"
    | "SIGNING_IN_PROGRESS"
    | "SIGNED"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";
  raw: unknown;
}

export interface SignedArtifactsResult {
  signedDocumentUrl?: string;
  signatureContainerUrl?: string;
  verificationResult?: unknown;
  certificateInfo?: unknown;
  raw: unknown;
}

export interface VerifyArtifactsInput {
  signedDocumentUrl?: string;
  signatureContainerUrl?: string;
}

export interface VerifyArtifactsResult {
  isValid: boolean;
  details: unknown;
}

export interface SignatureProviderAdapter {
  createEnvelope(input: CreateEnvelopeInput): Promise<CreateEnvelopeResult>;
  getEnvelopeStatus(providerEnvelopeId: string): Promise<EnvelopeStatusResult>;
  cancelEnvelope(providerEnvelopeId: string): Promise<void>;
  downloadSignedFiles(providerEnvelopeId: string): Promise<SignedArtifactsResult>;
  verifyArtifacts(input: VerifyArtifactsInput): Promise<VerifyArtifactsResult>;
}
