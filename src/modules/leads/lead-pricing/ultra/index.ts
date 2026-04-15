/**
 * @deprecated Use `src/features/estimate-core` for canonical pricing logic.
 */
export {
  calculatePricing,
  calculatePricingItem,
  buildPricingSummary,
  buildPricingTotals,
} from "./engine/calculate-pricing";
export { recalculatePricingSession } from "./services/pricing-session-service";
