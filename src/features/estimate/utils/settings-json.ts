import type { EstimateSectionType } from "../types/domain";

export const SETTINGS_JSON_V = 2 as const;

export type SectionUiState = {
  type?: EstimateSectionType;
  note?: string | null;
  isCollapsed?: boolean;
};

export type EstimateWorkspaceSettingsV2 = {
  v: typeof SETTINGS_JSON_V;
  extraMarginPct?: number;
  vatMode?: "none" | "included" | "on_top";
  vatRate?: number;
  rounding?: "none" | "1" | "10" | "100";
  paymentTermsPreview?: string;
  hideInternalCostsInQuote?: boolean;
  sectionNotes?: Record<string, string>;
  sectionUi?: Record<string, SectionUiState>;
  favoriteSupplierCodes?: string[];
  /** Останні коди пошуку в каталозі */
  recentSupplierSearches?: string[];
};

export function parseWorkspaceSettings(raw: unknown): EstimateWorkspaceSettingsV2 {
  if (!raw || typeof raw !== "object") {
    return { v: SETTINGS_JSON_V };
  }
  const o = raw as Record<string, unknown>;
  if (o.v === SETTINGS_JSON_V) {
    return o as EstimateWorkspaceSettingsV2;
  }
  return {
    v: SETTINGS_JSON_V,
    extraMarginPct:
      typeof o.extraMarginPct === "number" ? o.extraMarginPct : undefined,
    vatMode:
      o.vatMode === "none" ||
      o.vatMode === "included" ||
      o.vatMode === "on_top"
        ? o.vatMode
        : undefined,
    hideInternalCostsInQuote: o.hideInternalCostsInQuote === true,
    sectionNotes:
      o.sectionNotes && typeof o.sectionNotes === "object"
        ? (o.sectionNotes as Record<string, string>)
        : undefined,
  };
}
