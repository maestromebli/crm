import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SignatureSessionStatus } from "./diia-sign.provider";
import { MockDiiaSignAdapter } from "./mock-diia-sign.adapter";

const ContractStatus = {
  CUSTOMER_SIGNING: "CUSTOMER_SIGNING",
  CUSTOMER_SIGNED: "CUSTOMER_SIGNED",
  REJECTED: "REJECTED"
} as const;

@Injectable()
export class DiiaSignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adapter: MockDiiaSignAdapter
  ) {}

  async createSigningSession(contractId: string, shareToken: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { customer: true }
    });
    if (!contract) {
      throw new NotFoundException("Договір не знайдено");
    }

    const session = await this.adapter.createSigningSession({
      contractId,
      shareToken,
      signerFullName: contract.customer.fullName
    });

    const saved = await this.prisma.signatureSession.create({
      data: {
        contractId,
        providerSessionId: session.providerSessionId,
        signingUrl: session.signingUrl,
        status: session.status,
        providerPayload: session.rawPayload
      }
    });

    await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.CUSTOMER_SIGNING }
    });

    return saved;
  }

  async getSigningStatus(providerSessionId: string) {
    const status = await this.adapter.getSigningStatus(providerSessionId);
    await this.prisma.signatureSession.update({
      where: { providerSessionId },
      data: {
        status: status.status,
        providerPayload: status.rawPayload
      }
    });
    return status;
  }

  async handleWebhook(payload: { sessionId: string; status: string; data?: Record<string, unknown> }) {
    const mappedStatus = this.adapter.mapExternalStatus(payload.status);
    const session = await this.prisma.signatureSession.findUnique({
      where: { providerSessionId: payload.sessionId },
      include: { contract: true }
    });

    if (!session) {
      throw new NotFoundException("Сесію підпису не знайдено");
    }

    const contractStatus =
      mappedStatus === "SIGNED"
        ? ContractStatus.CUSTOMER_SIGNED
        : mappedStatus === "DECLINED"
          ? ContractStatus.REJECTED
          : ContractStatus.CUSTOMER_SIGNING;

    await this.prisma.$transaction([
      this.prisma.signatureSession.update({
        where: { id: session.id },
        data: {
          status: mappedStatus,
          providerPayload: payload.data ?? {}
        }
      }),
      this.prisma.contract.update({
        where: { id: session.contractId },
        data: {
          status: contractStatus,
          customerSignedAt: mappedStatus === "SIGNED" ? new Date() : undefined
        }
      }),
      this.prisma.contractAuditLog.create({
        data: {
          contractId: session.contractId,
          action: "DIIA_WEBHOOK_RECEIVED",
          actorRole: "integration",
          payloadJson: payload
        }
      })
    ]);

    return { ok: true };
  }
}
