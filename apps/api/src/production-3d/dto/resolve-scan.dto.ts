import { ProductionStage } from "../production-3d.types";

export interface ResolveScanDto {
  barcode: string;
  station: string;
  operatorName: string;
  stage: ProductionStage;
}

export interface UpdatePartStageDto {
  stage: ProductionStage;
  status?: string;
}
