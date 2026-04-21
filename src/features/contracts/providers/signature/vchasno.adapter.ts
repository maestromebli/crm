import type {
  CreateEnvelopeInput,
  CreateEnvelopeResult,
  EnvelopeStatusResult,
  SignatureProviderAdapter,
  SignedArtifactsResult,
  VerifyArtifactsInput,
  VerifyArtifactsResult,
} from "./signature-provider.types";

export class VchasnoSignatureAdapter implements SignatureProviderAdapter {
  private readonly baseUrl = process.env.VCHASNO_API_URL ?? "";
  private readonly apiKey = process.env.VCHASNO_API_KEY ?? "";
  private readonly useMock =
    !this.baseUrl || this.baseUrl === "/" || this.baseUrl.toLowerCase() === "mock";

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (this.useMock) {
      return this.mockRequest<T>(path, init);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vchasno API error: ${res.status} ${text}`);
    }

    return (await res.json()) as T;
  }

  private async mockRequest<T>(path: string, init?: RequestInit): Promise<T> {
    if (path === "/envelopes" && init?.method === "POST") {
      const payload = init?.body ? JSON.parse(String(init.body)) : {};
      return {
        id: `mock-env-${Date.now()}`,
        sessionId: `mock-session-${Date.now()}`,
        startUrl: `https://mock-sign.local/start/${Date.now()}`,
        deepLink: `mocksign://session/${Date.now()}`,
        qrCodeUrl: `https://mock-sign.local/qr/${Date.now()}`,
        payload,
      } as T;
    }

    if (path.includes("/artifacts")) {
      return {
        signedDocumentUrl: `https://mock-sign.local/files/signed-${Date.now()}.pdf`,
        signatureContainerUrl: `https://mock-sign.local/files/signature-${Date.now()}.p7s`,
        verificationResult: { provider: "VCHASNO_MOCK", ok: true },
        certificateInfo: { issuer: "Mock CA" },
      } as T;
    }

    if (path === "/verify" && init?.method === "POST") {
      return {
        isValid: true,
        provider: "VCHASNO_MOCK",
      } as T;
    }

    if (path.includes("/cancel") && init?.method === "POST") {
      return {} as T;
    }

    if (path.startsWith("/envelopes/")) {
      return {
        status: "SENT",
      } as T;
    }

    throw new Error(`Vchasno mock: unsupported path ${path}`);
  }

  async createEnvelope(input: CreateEnvelopeInput): Promise<CreateEnvelopeResult> {
    const raw = await this.request<Record<string, unknown>>("/envelopes", {
      method: "POST",
      body: JSON.stringify(input),
    });

    return {
      providerEnvelopeId: String(raw.id ?? raw.envelopeId),
      providerSessionId: raw.sessionId ? String(raw.sessionId) : undefined,
      startUrl: raw.startUrl ? String(raw.startUrl) : undefined,
      deepLink: raw.deepLink ? String(raw.deepLink) : undefined,
      qrCodeUrl: raw.qrCodeUrl ? String(raw.qrCodeUrl) : undefined,
      raw,
    };
  }

  async getEnvelopeStatus(providerEnvelopeId: string): Promise<EnvelopeStatusResult> {
    const raw = await this.request<Record<string, unknown>>(`/envelopes/${providerEnvelopeId}`);
    return {
      status: mapProviderStatus(String(raw.status ?? "")),
      raw,
    };
  }

  async cancelEnvelope(providerEnvelopeId: string): Promise<void> {
    await this.request(`/envelopes/${providerEnvelopeId}/cancel`, { method: "POST" });
  }

  async downloadSignedFiles(providerEnvelopeId: string): Promise<SignedArtifactsResult> {
    const raw = await this.request<Record<string, unknown>>(
      `/envelopes/${providerEnvelopeId}/artifacts`,
    );
    return {
      signedDocumentUrl: raw.signedDocumentUrl ? String(raw.signedDocumentUrl) : undefined,
      signatureContainerUrl: raw.signatureContainerUrl ? String(raw.signatureContainerUrl) : undefined,
      verificationResult: raw.verificationResult,
      certificateInfo: raw.certificateInfo,
      raw,
    };
  }

  async verifyArtifacts(input: VerifyArtifactsInput): Promise<VerifyArtifactsResult> {
    const raw = await this.request<Record<string, unknown>>("/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return {
      isValid: Boolean(raw.isValid),
      details: raw,
    };
  }
}

function mapProviderStatus(status: string): EnvelopeStatusResult["status"] {
  switch (status.toUpperCase()) {
    case "SENT":
      return "LINK_SENT";
    case "OPENED":
      return "OPENED";
    case "IDENTIFIED":
      return "IDENTIFIED";
    case "IN_PROGRESS":
      return "SIGNING_IN_PROGRESS";
    case "SIGNED":
      return "SIGNED";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "EXPIRED":
      return "EXPIRED";
    default:
      return "NOT_STARTED";
  }
}
