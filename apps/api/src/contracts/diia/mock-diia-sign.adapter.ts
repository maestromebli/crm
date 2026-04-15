import { Injectable } from "@nestjs/common";
import {
  CreateSigningSessionInput,
  SignatureProviderAdapter,
  SignatureSessionStatus,
  SigningSessionResult,
  SigningStatusResult
} from "./diia-sign.provider";

@Injectable()
export class MockDiiaSignAdapter implements SignatureProviderAdapter {
  async createSigningSession(input: CreateSigningSessionInput): Promise<SigningSessionResult> {
    const providerSessionId = `mock-diia-${input.contractId}-${Date.now()}`;
    return {
      providerSessionId,
      signingUrl: `https://mock.diia.local/sign/${providerSessionId}?token=${input.shareToken}`,
      status: "PENDING",
      rawPayload: {
        signer: input.signerFullName,
        mode: "mock"
      }
    };
  }

  async getSigningStatus(_providerSessionId: string): Promise<SigningStatusResult> {
    return {
      status: "IN_PROGRESS"
    };
  }

  mapExternalStatus(externalStatus: string): SignatureSessionStatus {
    switch (externalStatus) {
      case "CREATED":
        return "CREATED";
      case "PENDING":
        return "PENDING";
      case "PROCESSING":
        return "IN_PROGRESS";
      case "SIGNED":
        return "SIGNED";
      case "DECLINED":
        return "DECLINED";
      case "EXPIRED":
        return "EXPIRED";
      default:
        return "ERROR";
    }
  }
}
