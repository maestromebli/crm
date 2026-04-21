import type { Prisma, PrismaClient } from "@prisma/client";

export class ContractRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Prisma.EnverContractCreateInput) {
    return this.prisma.enverContract.create({
      data,
      include: { parties: true, sessions: true },
    });
  }

  findById(id: string) {
    return this.prisma.enverContract.findUnique({
      where: { id },
      include: {
        parties: true,
        sessions: { orderBy: { createdAt: "desc" } },
        artifacts: true,
        auditEvents: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
  }

  update(id: string, data: Prisma.EnverContractUpdateInput) {
    return this.prisma.enverContract.update({ where: { id }, data });
  }

  appendAudit(
    contractId: string,
    eventType: string,
    metadataJson?: Prisma.InputJsonValue,
    actor?: { actorId?: string; actorType?: string },
  ) {
    return this.prisma.enverContractAuditEvent.create({
      data: {
        contractId,
        eventType,
        metadataJson,
        actorId: actor?.actorId,
        actorType: actor?.actorType,
      },
    });
  }
}
