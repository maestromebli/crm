import { Module } from "@nestjs/common";
import { DocumentTemplateService } from "./document-template.service";

@Module({
  providers: [DocumentTemplateService],
  exports: [DocumentTemplateService]
})
export class DocumentTemplateModule {}
