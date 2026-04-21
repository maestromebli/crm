import type { Prisma, PrismaClient } from "@prisma/client";

export class ContractAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  createEvent(input: {
    contractId: string;
    eventType: string;
    actorId?: string;
    actorType?: string;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    return this.prisma.enverContractAuditEvent.create({
      data: input,
    });
  }

  listByContract(contractId: string, take = 100) {
    return this.prisma.enverContractAuditEvent.findMany({
      where: { contractId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
