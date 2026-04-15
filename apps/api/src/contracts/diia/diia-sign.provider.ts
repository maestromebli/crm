export type SignatureSessionStatus =
  | "CREATED"
  | "PENDING"
  | "IN_PROGRESS"
  | "SIGNED"
  | "DECLINED"
  | "EXPIRED"
  | "ERROR";

export interface CreateSigningSessionInput {
  contractId: string;
  shareToken: string;
  signerFullName: string;
}

export interface SigningSessionResult {
  providerSessionId: string;
  signingUrl: string;
  status: SignatureSessionStatus;
  rawPayload?: Record<string, unknown>;
}

export interface SigningStatusResult {
  status: SignatureSessionStatus;
  rawPayload?: Record<string, unknown>;
}

export interface SignatureProviderAdapter {
  createSigningSession(input: CreateSigningSessionInput): Promise<SigningSessionResult>;
  getSigningStatus(providerSessionId: string): Promise<SigningStatusResult>;
  mapExternalStatus(externalStatus: string): SignatureSessionStatus;
}
