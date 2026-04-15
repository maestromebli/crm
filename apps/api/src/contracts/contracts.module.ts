import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../auth/roles.guard";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";
import { DiiaWebhookController } from "./diia-webhook.controller";
import { DiiaSignService } from "./diia/diia-sign.service";
import { MockDiiaSignAdapter } from "./diia/mock-diia-sign.adapter";
import { DocumentGenerationService } from "./document-generation/document-generation.service";
import { DocumentStorageService } from "./document-generation/document-storage.service";
import { PdfExportService } from "./document-generation/pdf-export.service";
import { CustomerModule } from "./customer.module";
import { DocumentTemplateModule } from "./document-template.module";
import { PortalController } from "./portal.controller";
import { QuotationModule } from "./quotation.module";

@Module({
  imports: [CustomerModule, QuotationModule, DocumentTemplateModule],
  controllers: [ContractsController, PortalController, DiiaWebhookController],
  providers: [
    Reflector,
    RolesGuard,
    ContractsService,
    DocumentGenerationService,
    DocumentStorageService,
    PdfExportService,
    DiiaSignService,
    MockDiiaSignAdapter
  ]
})
export class ContractsModule {}
