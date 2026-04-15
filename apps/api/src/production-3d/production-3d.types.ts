export type ProductionStage = "CUTTING" | "EDGEBANDING" | "DRILLING" | "ASSEMBLY";

export type ScanResultStatus =
  | "OK"
  | "BARCODE_NOT_FOUND"
  | "MODEL_MISSING"
  | "MODULE_LINK_MISSING"
  | "ERROR";

export interface PartDimensions {
  width: number;
  height: number;
  thickness: number;
}

export interface Part3DTransform {
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface ProductionPart {
  id: string;
  orderId: string;
  productId: string;
  moduleId: string;
  internalId: string;
  barcode: string;
  articleCode: string;
  partName: string;
  dimensions: PartDimensions;
  material: string;
  edgingInfo: string;
  drillingInfo: string;
  status: string;
  currentStage: ProductionStage;
  objectId3d: string;
  transform: Part3DTransform;
}

export interface ProductionModule {
  id: string;
  productId: string;
  name: string;
}

export interface ProductionProduct {
  id: string;
  orderId: string;
  name: string;
  modelId: string;
  modelUrl: string;
}

export interface ProductionOrder {
  id: string;
  number: string;
  customer: string;
  projectName: string;
}

export interface ScanEvent {
  id: string;
  barcode: string;
  partId: string | null;
  orderId: string | null;
  productId: string | null;
  moduleId: string | null;
  stage: ProductionStage;
  station: string;
  operatorName: string;
  resultStatus: ScanResultStatus;
  scannedAt: string;
}
