import type { CatalogItemRecord, MaterialCatalogProvider } from "./material-provider-types";

const MOCK: CatalogItemRecord[] = [
  {
    supplierId: "local-1",
    supplierName: "Локальний прайс",
    itemCode: "LDSP-18-WH",
    itemName: "ЛДСП 18мм біла",
    unit: "м²",
    unitPrice: 920,
    currency: "UAH",
    lastUpdated: new Date().toISOString(),
    category: "ЛДСП",
  },
  {
    supplierId: "local-1",
    supplierName: "Локальний прайс",
    itemCode: "MDF-19-GF",
    itemName: "МДФ фарбований 19мм",
    unit: "м²",
    unitPrice: 1450,
    currency: "UAH",
    lastUpdated: new Date().toISOString(),
  },
  {
    supplierId: "generic",
    supplierName: "Універсальний каталог",
    itemCode: "BLUM-71B3550",
    itemName: "Петля напівнакладна Blum",
    unit: "шт",
    unitPrice: 185,
    currency: "UAH",
    lastUpdated: new Date().toISOString(),
    category: "Фурнітура",
  },
];

export class MockMaterialCatalogProvider implements MaterialCatalogProvider {
  readonly id = "mock";
  readonly displayName = "Демо-каталог";

  async search(query: { text: string; byCode?: boolean }): Promise<CatalogItemRecord[]> {
    const q = query.text.trim().toLowerCase();
    if (!q) return MOCK.slice(0, 20);
    return MOCK.filter((r) => {
      if (query.byCode) {
        return r.itemCode.toLowerCase().includes(q);
      }
      return (
        r.itemName.toLowerCase().includes(q) ||
        r.itemCode.toLowerCase().includes(q)
      );
    });
  }
}

export const defaultMaterialCatalogProvider = new MockMaterialCatalogProvider();
