import { Injectable } from "@nestjs/common";

@Injectable()
export class DocumentTemplateService {
  getTemplateVariables() {
    return [
      "{{contractNumber}}",
      "{{contractDate}}",
      "{{customerFullName}}",
      "{{customerTaxId}}",
      "{{objectAddress}}",
      "{{deliveryAddress}}",
      "{{totalAmount}}",
      "{{advanceAmount}}",
      "{{remainingAmount}}",
      "{{productionLeadTimeDays}}",
      "{{supplierName}}",
      "{{supplierSignerName}}",
      "{{supplierSignerBasis}}"
    ];
  }
}
