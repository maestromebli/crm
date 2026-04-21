export interface ContractPayloadContext {
  order: Record<string, unknown>;
  client: Record<string, unknown>;
  company: Record<string, unknown>;
}

export function buildContractPayload(ctx: ContractPayloadContext) {
  return {
    contract: {
      date: new Date().toISOString(),
    },
    order: ctx.order,
    client: ctx.client,
    company: ctx.company,
  };
}
