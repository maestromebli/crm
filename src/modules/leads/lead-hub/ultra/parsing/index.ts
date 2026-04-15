import type { LeadHubPricingItem } from "../domain/types";

export type ParsedTemplateResult = {
  items: LeadHubPricingItem[];
  meta: Record<string, unknown>;
};

function baseTemplate(seed: string): LeadHubPricingItem[] {
  return [
    {
      id: crypto.randomUUID(),
      name: `${seed} carcass`,
      quantity: 1,
      unitCost: 2200,
      unitPrice: 3200,
      category: "CARCASS",
    },
    {
      id: crypto.randomUUID(),
      name: `${seed} facade`,
      quantity: 1,
      unitCost: 1400,
      unitPrice: 2300,
      category: "FACADE",
    },
  ];
}

export async function parseImage(file: File): Promise<ParsedTemplateResult> {
  return {
    items: baseTemplate("Image"),
    meta: { fileName: file.name, parser: "image-v1" },
  };
}

export async function parseExcel(file: File): Promise<ParsedTemplateResult> {
  return {
    items: baseTemplate("Excel"),
    meta: { fileName: file.name, parser: "excel-v1" },
  };
}

export async function parsePDF(file: File): Promise<ParsedTemplateResult> {
  return {
    items: baseTemplate("PDF"),
    meta: { fileName: file.name, parser: "pdf-v1" },
  };
}
