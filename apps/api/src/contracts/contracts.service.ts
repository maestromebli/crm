import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContractFromQuotationDto } from "./dto/create-from-quotation.dto";
import { ShareContractDto } from "./dto/share-contract.dto";
import { UpdateContractDto } from "./dto/update-contract.dto";
import { DocumentGenerationService } from "./document-generation/document-generation.service";
import { DiiaSignService } from "./diia/diia-sign.service";

export interface ActorContext {
  role: string;
  userId?: string;
}

const ContractStatus = {
  FILLED: "FILLED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  SENT_TO_CUSTOMER: "SENT_TO_CUSTOMER",
  VIEWED_BY_CUSTOMER: "VIEWED_BY_CUSTOMER",
  CUSTOMER_SIGNING: "CUSTOMER_SIGNING",
  CUSTOMER_SIGNED: "CUSTOMER_SIGNED",
  FULLY_SIGNED: "FULLY_SIGNED",
  REJECTED: "REJECTED",
  NEEDS_REVISION: "NEEDS_REVISION"
} as const;

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentGenerationService: DocumentGenerationService,
    private readonly diiaSignService: DiiaSignService
  ) {}

  async createFromQuotation(dto: CreateContractFromQuotationDto, actor: ActorContext) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: dto.quotationId },
      include: { items: true }
    });
    if (!quotation) {
      throw new NotFoundException("Комерційну пропозицію не знайдено");
    }

    const deal = await this.prisma.deal.findUnique({ where: { id: dto.dealId } });
    if (!deal) {
      throw new NotFoundException("Угоду не знайдено");
    }

    const contractDate = dto.fields?.contractDate ? new Date(dto.fields.contractDate) : new Date();
    const totalAmount = dto.fields?.totalAmount ?? Number(quotation.totalAmount);
    const advanceAmount = dto.fields?.advanceAmount ?? 0;
    const remainingAmount = dto.fields?.remainingAmount ?? totalAmount - advanceAmount;

    const contract = await this.prisma.$transaction(async (tx: any) => {
      const customer = await tx.customer.create({
        data: {
          fullName: dto.customer.fullName,
          taxId: dto.customer.taxId,
          passportData: dto.customer.passportData,
          phone: dto.customer.phone,
          email: dto.customer.email,
          address: dto.customer.address
        }
      });

      const createdContract = await tx.contract.create({
        data: {
          dealId: dto.dealId,
          quotationId: dto.quotationId,
          customerId: customer.id,
          status: ContractStatus.FILLED,
          contractNumber: dto.fields?.contractNumber ?? `ENV-${Date.now()}`,
          contractDate,
          customerType: dto.fields?.customerType ?? "PERSON",
          objectAddress: dto.fields?.objectAddress ?? dto.customer.address,
          deliveryAddress: dto.fields?.deliveryAddress ?? dto.customer.address,
          totalAmount,
          advanceAmount,
          remainingAmount,
          productionLeadTimeDays: dto.fields?.productionLeadTimeDays ?? 30,
          installationLeadTime: dto.fields?.installationLeadTime ?? "3-5 днів після доставки",
          paymentTerms: dto.fields?.paymentTerms ?? "70% аванс, 30% перед відвантаженням",
          warrantyMonths: dto.fields?.warrantyMonths ?? 18,
          managerComment: dto.fields?.managerComment,
          specialConditions: dto.fields?.specialConditions,
          supplierSignerName: dto.fields?.supplierSignerName ?? "Мамедов Енвер Микаилович",
          supplierSignerBasis: dto.fields?.supplierSignerBasis ?? "на підставі державної реєстрації",
          createdById: actor.userId
        }
      });

      const specification = await tx.contractSpecification.create({
        data: {
          contractId: createdContract.id,
          subtotal: totalAmount,
          total: totalAmount,
          totalFormattedText: `${totalAmount.toFixed(2)} гривень`,
          currency: quotation.currency
        }
      });

      if (quotation.items.length > 0) {
        await tx.contractSpecificationItem.createMany({
          data: quotation.items.map((item: any, index: number) => ({
            specificationId: specification.id,
            lineNumber: item.lineNumber || index + 1,
            productName: item.productName,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            notes: item.notes
          }))
        });
      }

      const fieldEntries = this.extractFieldEntries(dto);
      if (fieldEntries.length > 0) {
        await tx.contractFieldValue.createMany({
          data: fieldEntries.map((entry) => ({
            contractId: createdContract.id,
            fieldKey: entry.fieldKey,
            fieldValue: entry.fieldValue
          }))
        });
      }

      await tx.contractAuditLog.create({
        data: {
          contractId: createdContract.id,
          action: "CONTRACT_CREATED_FROM_QUOTATION",
          actorRole: actor.role,
          actorUserId: actor.userId,
          payloadJson: {
            quotationId: quotation.id,
            items: quotation.items.length
          }
        }
      });

      return createdContract;
    });

    return this.getById(contract.id);
  }

  async getById(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        customer: true,
        quotation: { include: { items: true } },
        specification: { include: { items: { orderBy: { lineNumber: "asc" } } } },
        documents: { orderBy: { createdAt: "desc" } },
        shareLinks: { orderBy: { createdAt: "desc" } },
        auditLogs: { orderBy: { createdAt: "desc" } },
        signatureSessions: { orderBy: { createdAt: "desc" } },
        fieldValues: true
      }
    });
    if (!contract) {
      throw new NotFoundException("Договір не знайдено");
    }
    return contract;
  }

  async updateContract(id: string, dto: UpdateContractDto, actor: ActorContext) {
    const current = await this.prisma.contract.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException("Договір не знайдено");
    }
    if (current.status === ContractStatus.CUSTOMER_SIGNED || current.status === ContractStatus.FULLY_SIGNED) {
      throw new ForbiddenException("Підписаний договір редагувати не можна");
    }

    const hasLockedFinancialChanges =
      dto.fields?.totalAmount !== undefined ||
      dto.fields?.advanceAmount !== undefined ||
      dto.fields?.remainingAmount !== undefined;

    if (
      current.status === ContractStatus.APPROVED &&
      hasLockedFinancialChanges &&
      dto.status !== ContractStatus.NEEDS_REVISION
    ) {
      throw new BadRequestException("Після статусу APPROVED зміну сум можна робити тільки через NEEDS_REVISION");
    }

    const data: Record<string, unknown> = {};
    if (dto.status) {
      data.status = dto.status;
    }
    if (dto.fields) {
      data.contractNumber = dto.fields.contractNumber ?? undefined;
      data.contractDate = dto.fields.contractDate ? new Date(dto.fields.contractDate) : undefined;
      data.customerType = dto.fields.customerType ?? undefined;
      data.objectAddress = dto.fields.objectAddress ?? undefined;
      data.deliveryAddress = dto.fields.deliveryAddress ?? undefined;
      data.totalAmount = dto.fields.totalAmount !== undefined ? dto.fields.totalAmount : undefined;
      data.advanceAmount = dto.fields.advanceAmount !== undefined ? dto.fields.advanceAmount : undefined;
      data.remainingAmount = dto.fields.remainingAmount !== undefined ? dto.fields.remainingAmount : undefined;
      data.productionLeadTimeDays = dto.fields.productionLeadTimeDays ?? undefined;
      data.installationLeadTime = dto.fields.installationLeadTime ?? undefined;
      data.paymentTerms = dto.fields.paymentTerms ?? undefined;
      data.warrantyMonths = dto.fields.warrantyMonths ?? undefined;
      data.managerComment = dto.fields.managerComment ?? undefined;
      data.specialConditions = dto.fields.specialConditions ?? undefined;
      data.supplierSignerName = dto.fields.supplierSignerName ?? undefined;
      data.supplierSignerBasis = dto.fields.supplierSignerBasis ?? undefined;
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.contract.update({ where: { id }, data });

      if (dto.fields) {
        const fieldRows = Object.entries(dto.fields)
          .filter((entry) => entry[1] !== undefined)
          .map(([fieldKey, value]) => ({
            contractId: id,
            fieldKey,
            fieldValue: value === null ? null : String(value)
          }));

        for (const row of fieldRows) {
          await tx.contractFieldValue.upsert({
            where: { contractId_fieldKey: { contractId: id, fieldKey: row.fieldKey } },
            update: { fieldValue: row.fieldValue ?? undefined },
            create: row
          });
        }
      }

      await tx.contractAuditLog.create({
        data: {
          contractId: id,
          action: "CONTRACT_UPDATED",
          actorRole: actor.role,
          actorUserId: actor.userId,
          payloadJson: dto
        }
      });
    });

    return this.getById(id);
  }

  async generateDocuments(id: string, actor: ActorContext) {
    await this.ensureCanEdit(id);
    const documents = await this.documentGenerationService.generateContractAndSpecification(id);
    await this.prisma.contractAuditLog.create({
      data: {
        contractId: id,
        action: "CONTRACT_DOCUMENT_SNAPSHOT_CREATED",
        actorRole: actor.role,
        actorUserId: actor.userId,
        payloadJson: { documentIds: documents.map((doc: any) => doc.id) }
      }
    });
    return documents;
  }

  async sendForReview(id: string, actor: ActorContext) {
    const contract = await this.getById(id);
    if (![ContractStatus.FILLED, ContractStatus.NEEDS_REVISION].includes(contract.status)) {
      throw new BadRequestException("Договір не готовий до рев'ю");
    }
    await this.prisma.contract.update({
      where: { id },
      data: { status: ContractStatus.UNDER_REVIEW }
    });
    await this.log(id, "CONTRACT_SENT_FOR_REVIEW", actor);
    return this.getById(id);
  }

  async approve(id: string, actor: ActorContext) {
    const contract = await this.getById(id);
    if (contract.status !== ContractStatus.UNDER_REVIEW) {
      throw new BadRequestException("Підтвердження можливе тільки зі статусу UNDER_REVIEW");
    }
    await this.prisma.contract.update({
      where: { id },
      data: { status: ContractStatus.APPROVED, approvedAt: new Date() }
    });
    await this.log(id, "CONTRACT_APPROVED", actor);
    return this.getById(id);
  }

  async shareContract(id: string, dto: ShareContractDto, actor: ActorContext) {
    const contract = await this.getById(id);
    if (contract.status !== ContractStatus.APPROVED) {
      throw new BadRequestException("Надсилання клієнту дозволено лише після статусу APPROVED");
    }
    const expiresInHours = dto.expiresInHours ?? 72;
    const token = randomUUID().split("-").join("");
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const link = await this.prisma.contractShareLink.create({
      data: {
        contractId: id,
        token,
        expiresAt,
        maxViews: dto.maxViews,
        createdById: actor.userId
      }
    });

    await this.prisma.contract.update({
      where: { id },
      data: {
        status: ContractStatus.SENT_TO_CUSTOMER,
        sentToCustomerAt: new Date()
      }
    });

    await this.log(id, "CONTRACT_SHARED", actor, {
      token: link.token,
      expiresAt: link.expiresAt,
      maxViews: link.maxViews
    });

    return {
      ...link,
      portalUrl: `/portal/contracts/${link.token}`
    };
  }

  async getPortalContract(token: string) {
    const shareLink = await this.prisma.contractShareLink.findUnique({
      where: { token },
      include: {
        contract: {
          include: {
            customer: true,
            specification: { include: { items: { orderBy: { lineNumber: "asc" } } } },
            documents: { orderBy: { createdAt: "desc" } },
            signatureSessions: { orderBy: { createdAt: "desc" } }
          }
        }
      }
    });
    if (!shareLink) {
      throw new NotFoundException("Посилання недійсне");
    }
    if (shareLink.status !== "ACTIVE" || shareLink.expiresAt < new Date()) {
      throw new ForbiddenException("Посилання більше не активне");
    }
    if (shareLink.maxViews && shareLink.viewCount >= shareLink.maxViews) {
      throw new ForbiddenException("Ліміт переглядів вичерпано");
    }

    return shareLink;
  }

  async markPortalViewed(token: string) {
    const shareLink = await this.getPortalContract(token);
    await this.prisma.$transaction([
      this.prisma.contractShareLink.update({
        where: { id: shareLink.id },
        data: {
          viewCount: { increment: 1 },
          lastViewedAt: new Date()
        }
      }),
      this.prisma.contract.update({
        where: { id: shareLink.contractId },
        data: {
          status: ContractStatus.VIEWED_BY_CUSTOMER,
          viewedByCustomerAt: new Date()
        }
      }),
      this.prisma.contractAuditLog.create({
        data: {
          contractId: shareLink.contractId,
          action: "PORTAL_VIEWED",
          actorRole: "client",
          payloadJson: { token }
        }
      })
    ]);
    return { ok: true };
  }

  async signViaPortal(token: string) {
    const shareLink = await this.getPortalContract(token);
    const session = await this.diiaSignService.createSigningSession(shareLink.contractId, token);
    await this.prisma.contractShareLink.update({
      where: { id: shareLink.id },
      data: { signatureSession: { connect: { id: session.id } } }
    });
    return session;
  }

  async createNeedsRevision(id: string, actor: ActorContext) {
    await this.prisma.contract.update({
      where: { id },
      data: { status: ContractStatus.NEEDS_REVISION }
    });
    await this.log(id, "STATUS_NEEDS_REVISION", actor);
    return this.getById(id);
  }

  private async ensureCanEdit(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException("Договір не знайдено");
    }
    if ([ContractStatus.CUSTOMER_SIGNED, ContractStatus.FULLY_SIGNED].includes(contract.status)) {
      throw new BadRequestException("Після підписання зміни заблоковано");
    }
  }

  private extractFieldEntries(dto: CreateContractFromQuotationDto) {
    if (!dto.fields) {
      return [];
    }
    return Object.entries(dto.fields)
      .filter((entry) => entry[1] !== undefined)
      .map(([fieldKey, value]) => ({
        fieldKey,
        fieldValue: String(value)
      }));
  }

  private async log(contractId: string, action: string, actor: ActorContext, payloadJson?: object) {
    await this.prisma.contractAuditLog.create({
      data: {
        contractId,
        action,
        actorRole: actor.role,
        actorUserId: actor.userId,
        payloadJson
      }
    });
  }
}
