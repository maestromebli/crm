import { z } from "zod";

/** Вбудовані чіпи «збережених виглядів» у DealsHub (лише відкриті замовлення). */
export const SAVED_VIEW_CHIP_IDS = [
  "all_open",
  "no_next",
  "overdue_next",
  "wait_pay",
  "no_est",
  "no_contract",
  "stale",
] as const;

export type SavedViewChipId = (typeof SAVED_VIEW_CHIP_IDS)[number];

export const SORT_KEYS = [
  "updated_desc",
  "value_desc",
  "client_asc",
  "stage_asc",
] as const;

export type DealHubSortKey = (typeof SORT_KEYS)[number];

/** Знімок UI, який зберігається в БД і відновлюється одним кліком. */
export type DealHubFilters = {
  savedView: SavedViewChipId;
  sortKey: DealHubSortKey;
  /** `"all"` або `ownerId` */
  ownerFilter: string;
  layout: "table" | "board";
  showInsights: boolean;
  /** Опційно — збережений пошук */
  search?: string;
};

export const defaultDealHubFilters = (): DealHubFilters => ({
  savedView: "all_open",
  sortKey: "updated_desc",
  ownerFilter: "all",
  layout: "table",
  showInsights: true,
  search: "",
});

export const dealHubFiltersSchema = z.object({
  savedView: z.enum(SAVED_VIEW_CHIP_IDS),
  sortKey: z.enum(SORT_KEYS),
  ownerFilter: z.string().min(1).max(64),
  layout: z.enum(["table", "board"]),
  showInsights: z.boolean(),
  search: z.string().max(500).optional(),
});

export type DealHubSavedViewDTO = {
  id: string;
  name: string;
  filters: DealHubFilters;
  updatedAt: string;
};
