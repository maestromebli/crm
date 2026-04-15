export type SupplierKey = "VIYAR" | "CSV" | "MANUAL";

export type SupplierCurrency = "UAH";

export type SupplierItem = {
  id: string;
  supplier: SupplierKey;
  name: string;
  code?: string;
  category?: string;
  unit: string;
  price: number;
  currency: SupplierCurrency;
  updatedAt: string;
  metadata?: {
    thickness?: string;
    color?: string;
    brand?: string;
  };
};

export type SupplierSearchQuery = {
  query: string;
  limit?: number;
  suppliers?: SupplierKey[];
};

export type SupplierSearchResult = {
  query: string;
  items: SupplierItem[];
  elapsedMs: number;
  cached: boolean;
};

export type SupplierSyncSummary = {
  providerKey: string;
  providerName: string;
  importedRows: number;
  upserted: number;
  changedPrices: number;
  markedOutdated: number;
  skipped: number;
  deleted: number;
  syncedAt: string;
};

export type SupplierPriceChangeEntry = {
  id: string;
  providerKey: string;
  providerName: string;
  itemExternalId: string;
  itemName: string;
  previousPrice: number;
  currentPrice: number;
  currency: "UAH";
  changedAt: string;
};

export type SupplierProvider = {
  key: SupplierKey;
  label: string;
  search: (query: SupplierSearchQuery) => Promise<SupplierItem[]>;
  getById: (id: string) => Promise<SupplierItem | null>;
};
