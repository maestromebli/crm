export const PROCUREMENT_QUICK_ACTION_QUERY = {
  view: "view",
  hubView: "hub",
  newRequest: "newRequest",
  dealId: "dealId",
  source: "source",
} as const;

export type ProcurementQuickAction = {
  isHubView: boolean;
  openNewRequest: boolean;
  dealId: string;
  source: string;
};

type ProcurementQueryLike = {
  view?: string;
  newRequest?: string;
  dealId?: string;
  source?: string;
};

export function parseProcurementQuickAction(query?: ProcurementQueryLike): ProcurementQuickAction {
  return {
    isHubView: query?.view === PROCUREMENT_QUICK_ACTION_QUERY.hubView,
    openNewRequest: query?.newRequest === "1",
    dealId: query?.dealId?.trim() ?? "",
    source: query?.source?.trim() ?? "",
  };
}

type SearchParamsReader = {
  get(name: string): string | null;
};

export function parseProcurementQuickActionFromSearchParams(
  searchParams: SearchParamsReader,
): ProcurementQuickAction {
  return parseProcurementQuickAction({
    view: searchParams.get(PROCUREMENT_QUICK_ACTION_QUERY.view) ?? undefined,
    newRequest: searchParams.get(PROCUREMENT_QUICK_ACTION_QUERY.newRequest) ?? undefined,
    dealId: searchParams.get(PROCUREMENT_QUICK_ACTION_QUERY.dealId) ?? undefined,
    source: searchParams.get(PROCUREMENT_QUICK_ACTION_QUERY.source) ?? undefined,
  });
}

export function buildProcurementHubHref(): string {
  return `/crm/procurement?${PROCUREMENT_QUICK_ACTION_QUERY.view}=${PROCUREMENT_QUICK_ACTION_QUERY.hubView}`;
}

export function buildProcurementHubNewRequestHref(
  dealId?: string,
  source?: "constructor_workspace" | "procurement_hub",
): string {
  const params = new URLSearchParams({
    [PROCUREMENT_QUICK_ACTION_QUERY.view]: PROCUREMENT_QUICK_ACTION_QUERY.hubView,
    [PROCUREMENT_QUICK_ACTION_QUERY.newRequest]: "1",
  });
  const normalizedDealId = dealId?.trim();
  if (normalizedDealId) {
    params.set(PROCUREMENT_QUICK_ACTION_QUERY.dealId, normalizedDealId);
  }
  if (source) {
    params.set(PROCUREMENT_QUICK_ACTION_QUERY.source, source);
  }
  return `/crm/procurement?${params.toString()}`;
}

type MutableSearchParams = {
  has(name: string): boolean;
  delete(name: string): void;
};

export function clearProcurementQuickActionParams(searchParams: MutableSearchParams): boolean {
  let changed = false;
  if (searchParams.has(PROCUREMENT_QUICK_ACTION_QUERY.newRequest)) {
    searchParams.delete(PROCUREMENT_QUICK_ACTION_QUERY.newRequest);
    changed = true;
  }
  if (searchParams.has(PROCUREMENT_QUICK_ACTION_QUERY.dealId)) {
    searchParams.delete(PROCUREMENT_QUICK_ACTION_QUERY.dealId);
    changed = true;
  }
  if (searchParams.has(PROCUREMENT_QUICK_ACTION_QUERY.source)) {
    searchParams.delete(PROCUREMENT_QUICK_ACTION_QUERY.source);
    changed = true;
  }
  return changed;
}
