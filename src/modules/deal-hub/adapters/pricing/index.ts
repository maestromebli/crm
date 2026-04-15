export type DealHubPricingAdapterInput = {
  dealId: string;
};

export function resolveDealHubPricingAdapter(input: DealHubPricingAdapterInput) {
  return {
    source: "estimate-core",
    dealId: input.dealId,
  };
}
