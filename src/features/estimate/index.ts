export type {
  EstimateVersion,
  EstimateSection,
  EstimateItem,
  EstimateSummary,
  EstimateWarning,
  QuotePayload,
  FormulaConfig,
  PricingMode,
} from "./types/domain";
export {
  calculateEstimateSummary,
  calculateSectionTotals,
  recalculateEstimateItem,
  calculateItemCost,
  calculateItemDiscount,
  calculateItemSaleAfterDiscount,
  deriveAreaM2,
} from "./utils/calculations";
export { calculateWarnings } from "./utils/warnings";
export {
  lineModelToEstimateItem,
  estimateItemToLineModel,
  normalizeLineModel,
  type LineModel,
  type SectionModel,
} from "./mappers/line-domain-mapper";
export { mapEstimateToQuotePayload } from "./mappers/quote-payload";
export { parseWorkspaceSettings, SETTINGS_JSON_V } from "./utils/settings-json";
export type { EstimateWorkspaceSettingsV2 } from "./utils/settings-json";
export type { MaterialCatalogProvider, CatalogItemRecord } from "./services/material-provider-types";
export { MockMaterialCatalogProvider, defaultMaterialCatalogProvider } from "./services/mock-material-catalog";
