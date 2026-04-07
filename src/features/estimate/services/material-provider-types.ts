export type CatalogItemRecord = {
  supplierId: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  currency: string;
  lastUpdated: string;
  category?: string;
};

export interface MaterialCatalogProvider {
  readonly id: string;
  readonly displayName: string;
  search(query: { text: string; byCode?: boolean }): Promise<CatalogItemRecord[]>;
}
