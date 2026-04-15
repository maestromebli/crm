import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PdfExportService } from "./pdf-export.service";
import { DocumentStorageService } from "./document-storage.service";
import { renderContractHtml } from "./templates/contract.template";
import { renderSpecificationHtml } from "./templates/specification.template";

const ContractDocumentType = {
  CONTRACT_HTML: "CONTRACT_HTML",
  SPECIFICATION_HTML: "SPECIFICATION_HTML",
  CONTRACT_PDF: "CONTRACT_PDF",
  SPECIFICATION_PDF: "SPECIFICATION_PDF"
} as const;

@Injectable()
export class DocumentGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfExportService: PdfExportService,
    private readonly storageService: DocumentStorageService
  ) {}

  async generateContractAndSpecification(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        customer: true,
        specification: { include: { items: true } }
      }
    });
    if (!contract || !contract.specification) {
      throw new NotFoundException("Договір або специфікація не знайдені");
    }

    const contractHtml = renderContractHtml({
      contractNumber: contract.contractNumber,
      contractDate: contract.contractDate,
      customerFullName: contract.customer.fullName,
      customerTaxId: contract.customer.taxId,
      customerPassportData: contract.customer.passportData,
      customerPhone: contract.customer.phone,
      customerEmail: contract.customer.email,
      objectAddress: contract.objectAddress,
      deliveryAddress: contract.deliveryAddress,
      totalAmount: Number(contract.totalAmount),
      advanceAmount: Number(contract.advanceAmount),
      remainingAmount: Number(contract.remainingAmount),
      productionLeadTimeDays: contract.productionLeadTimeDays,
      installationLeadTime: contract.installationLeadTime,
      paymentTerms: contract.paymentTerms,
      warrantyMonths: contract.warrantyMonths,
      managerComment: contract.managerComment,
      specialConditions: contract.specialConditions,
      supplierSignerName: contract.supplierSignerName,
      supplierSignerBasis: contract.supplierSignerBasis
    });

    const specificationHtml = renderSpecificationHtml({
      contractNumber: contract.contractNumber,
      lines: contract.specification.items.map((item: any) => ({
        lineNumber: item.lineNumber,
        productName: item.productName,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
        notes: item.notes
      })),
      subtotal: Number(contract.specification.subtotal),
      total: Number(contract.specification.total),
      currency: contract.specification.currency
    });

    const contractPdf = await this.pdfExportService.exportHtmlToPdf(contractHtml, "Договір");
    const specificationPdf = await this.pdfExportService.exportHtmlToPdf(specificationHtml, "Специфікація");

    const contractHtmlPath = await this.storageService.save(contract.id, "contract.html", contractHtml);
    const specificationHtmlPath = await this.storageService.save(contract.id, "specification.html", specificationHtml);
    const contractPdfPath = await this.storageService.save(contract.id, "contract.pdf", contractPdf);
    const specificationPdfPath = await this.storageService.save(contract.id, "specification.pdf", specificationPdf);

    const docs = await this.prisma.$transaction([
      this.prisma.contractDocument.create({
        data: {
          contractId: contract.id,
          type: ContractDocumentType.CONTRACT_HTML,
          fileName: "contract.html",
          storageKey: contractHtmlPath,
          mimeType: "text/html",
          htmlBody: contractHtml
        }
      }),
      this.prisma.contractDocument.create({
        data: {
          contractId: contract.id,
          type: ContractDocumentType.SPECIFICATION_HTML,
          fileName: "specification.html",
          storageKey: specificationHtmlPath,
          mimeType: "text/html",
          htmlBody: specificationHtml
        }
      }),
      this.prisma.contractDocument.create({
        data: {
          contractId: contract.id,
          type: ContractDocumentType.CONTRACT_PDF,
          fileName: "contract.pdf",
          storageKey: contractPdfPath,
          mimeType: "application/pdf",
          pdfUrl: contractPdfPath
        }
      }),
      this.prisma.contractDocument.create({
        data: {
          contractId: contract.id,
          type: ContractDocumentType.SPECIFICATION_PDF,
          fileName: "specification.pdf",
          storageKey: specificationPdfPath,
          mimeType: "application/pdf",
          pdfUrl: specificationPdfPath
        }
      })
    ]);

    await this.prisma.contractAuditLog.create({
      data: {
        contractId: contract.id,
        action: "DOCUMENTS_GENERATED",
        actorRole: "manager",
        payloadJson: { documentIds: docs.map((doc: any) => doc.id) }
      }
    });

    return docs;
  }
}
