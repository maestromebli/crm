import type { EstimateCategoryKey } from "../../../../lib/estimates/estimate-categories";

export type PageMode = "view" | "draft" | "compare";

export type VersionStatusUi = "draft" | "current" | "archived";

export type UnitPriceSource = "manual" | "supplier_snapshot";

export type SupplierPriceSnapshot = {
  supplier: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  price: number;
  currency: string;
  capturedAt: string;
};

export type MaterialSearchHit = {
  supplier: string;
  materialId: string;
  code: string;
  name: string;
  price: number;
  currency: string;
  attrs?: string[];
};

export type VersionItem = {
  id: string;
  sortOrder: number;
  categoryKey: EstimateCategoryKey;
  title: string;
  qty: number;
  coefficient: number;
  unitPrice: number;
  totalPrice: number;
  supplier: string | null;
  supplierMaterialId: string | null;
  supplierMaterialCode: string | null;
  supplierMaterialName: string | null;
  supplierPriceSnapshot: SupplierPriceSnapshot | null;
  unitPriceSource: UnitPriceSource;
  note?: string | null;
};

export type DraftItem = {
  tempId: string;
  baseItemId?: string;
  sortOrder: number;
  categoryKey: EstimateCategoryKey;
  title: string;
  qty: number;
  coefficient: number;
  unitPrice: number;
  totalPrice: number;
  supplier: string | null;
  supplierMaterialId: string | null;
  supplierMaterialCode: string | null;
  supplierMaterialName: string | null;
  supplierPriceSnapshot: SupplierPriceSnapshot | null;
  unitPriceSource: UnitPriceSource;
  note?: string | null;
};

export type EstimateVersionModel = {
  id: string;
  versionNumber: number;
  status: VersionStatusUi;
  baseVersionId?: string | null;
  changeNote?: string | null;
  currency: string;
  createdAt: string;
  createdBy: string;
  items: VersionItem[];
  total: number;
  subtotal: number;
};

export type ChangedField = {
  field: string;
  from: string | number | null;
  to: string | number | null;
};

export type ChangedItem = {
  baseItemId: string;
  title: string;
  fields: ChangedField[];
  beforeTotal: number;
  afterTotal: number;
};

export type DiffResult = {
  added: DraftItem[];
  removed: VersionItem[];
  changed: ChangedItem[];
  totalDelta: number;
};

export type LeadMini = {
  id: string;
  title: string;
  customerName: string;
  phone: string;
  stage: string;
};
