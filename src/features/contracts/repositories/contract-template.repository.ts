import type { Prisma, PrismaClient } from "@prisma/client";

export class ContractTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findPublishedByCode(code: string) {
    return this.prisma.enverContractTemplate.findFirst({
      where: { code, status: "PUBLISHED", isActive: true },
      orderBy: { version: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.enverContractTemplate.findUnique({ where: { id } });
  }

  listAll() {
    return this.prisma.enverContractTemplate.findMany({
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });
  }

  create(data: Prisma.EnverContractTemplateCreateInput) {
    return this.prisma.enverContractTemplate.create({ data });
  }

  update(id: string, data: Prisma.EnverContractTemplateUpdateInput) {
    return this.prisma.enverContractTemplate.update({ where: { id }, data });
  }
}
