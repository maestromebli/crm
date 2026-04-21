export function freezeContractSnapshot(input: {
  payloadJson: Record<string, unknown>;
  order: Record<string, unknown>;
}) {
  return {
    payloadJson: structuredClone(input.payloadJson),
    pricingSnapshotJson: {
      total: input.order.total ?? input.order.amount ?? null,
      discount: input.order.discount ?? null,
      prepaymentAmount: input.order.prepaymentAmount ?? null,
      paymentTerms: input.order.paymentTerms ?? null,
      productionDeadline: input.order.productionDeadline ?? null,
    },
  };
}
