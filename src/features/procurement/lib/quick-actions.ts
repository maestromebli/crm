export const PROCUREMENT_QUICK_ACTION_QUERY = {
  view: "view",
  hubView: "hub",
  newRequest: "newRequest",
  dealId: "dealId",
} as const;

export type ProcurementQuickAction = {
  isHubView: boolean;
  openNewRequest: boolean;
  dealId: string;
};

type ProcurementQueryLike = {
  view?: string;
  newRequest?: string;
  dealId?: string;
};

export function parseProcurementQuickAction(query?: ProcurementQueryLike): ProcurementQuickAction {
  return {
    isHubView: query?.view === PROCUREMENT_QUICK_ACTION_QUERY.hubView,
    openNewRequest: query?.newRequest === "1",
    dealId: query?.dealId?.trim() ?? "",
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
  });
}

export function buildProcurementHubHref(): string {
  return `/crm/procurement?${PROCUREMENT_QUICK_ACTION_QUERY.view}=${PROCUREMENT_QUICK_ACTION_QUERY.hubView}`;
}

export function buildProcurementHubNewRequestHref(dealId?: string): string {
  const params = new URLSearchParams({
    [PROCUREMENT_QUICK_ACTION_QUERY.view]: PROCUREMENT_QUICK_ACTION_QUERY.hubView,
    [PROCUREMENT_QUICK_ACTION_QUERY.newRequest]: "1",
  });
  const normalizedDealId = dealId?.trim();
  if (normalizedDealId) {
    params.set(PROCUREMENT_QUICK_ACTION_QUERY.dealId, normalizedDealId);
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
  return changed;
}
