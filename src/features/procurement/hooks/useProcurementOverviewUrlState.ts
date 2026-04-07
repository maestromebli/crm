"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { procurementKpiFilterPreset } from "../lib/kpi-deeplink";

/** Query keys для огляду закупівель — можна ділитися посиланням. */
export const PROCUREMENT_URL_KEYS = {
  q: "q",
  project: "project",
  itemStatus: "itemStatus",
  requestStatus: "requestStatus",
  /** Deep link з KPI-карток (`ProcurementKpiCards`). */
  kpi: "kpi",
} as const;

const DEBOUNCE_MS = 400;

export function useProcurementOverviewUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const urlQ = searchParams.get(PROCUREMENT_URL_KEYS.q) ?? "";
  const projectId = searchParams.get(PROCUREMENT_URL_KEYS.project) ?? "";
  const itemStatus = searchParams.get(PROCUREMENT_URL_KEYS.itemStatus) ?? "";
  const requestStatus = searchParams.get(PROCUREMENT_URL_KEYS.requestStatus) ?? "";

  const [qDraft, setQDraft] = useState(urlQ);
  useEffect(() => {
    setQDraft(urlQ);
  }, [urlQ]);

  const replaceSearchParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParamsRef.current.toString());
      mutate(next);
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  /** `?kpi=` з карток огляду — підставляє пресети фільтрів (один раз на значення kpi). */
  const kpiApplyRef = useRef<string | null>(null);
  useEffect(() => {
    const k = searchParams.get(PROCUREMENT_URL_KEYS.kpi);
    if (!k) {
      kpiApplyRef.current = null;
      return;
    }
    if (kpiApplyRef.current === k) return;
    const preset = procurementKpiFilterPreset(k);
    kpiApplyRef.current = k;
    if (!preset) return;
    replaceSearchParams((p) => {
      if (preset.itemStatus) p.set(PROCUREMENT_URL_KEYS.itemStatus, preset.itemStatus);
      else p.delete(PROCUREMENT_URL_KEYS.itemStatus);
      if (preset.requestStatus) p.set(PROCUREMENT_URL_KEYS.requestStatus, preset.requestStatus);
      else p.delete(PROCUREMENT_URL_KEYS.requestStatus);
    });
  }, [searchParams, replaceSearchParams]);

  useEffect(() => {
    const current = searchParamsRef.current.get(PROCUREMENT_URL_KEYS.q) ?? "";
    if (qDraft === current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParamsRef.current.toString());
      if (!qDraft.trim()) next.delete(PROCUREMENT_URL_KEYS.q);
      else next.set(PROCUREMENT_URL_KEYS.q, qDraft);
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [qDraft, pathname, router]);

  const setProjectId = useCallback(
    (v: string) => {
      replaceSearchParams((p) => {
        if (!v) p.delete(PROCUREMENT_URL_KEYS.project);
        else p.set(PROCUREMENT_URL_KEYS.project, v);
      });
    },
    [replaceSearchParams],
  );

  const setItemStatus = useCallback(
    (v: string) => {
      replaceSearchParams((p) => {
        if (!v) p.delete(PROCUREMENT_URL_KEYS.itemStatus);
        else p.set(PROCUREMENT_URL_KEYS.itemStatus, v);
      });
    },
    [replaceSearchParams],
  );

  const setRequestStatus = useCallback(
    (v: string) => {
      replaceSearchParams((p) => {
        if (!v) p.delete(PROCUREMENT_URL_KEYS.requestStatus);
        else p.set(PROCUREMENT_URL_KEYS.requestStatus, v);
      });
    },
    [replaceSearchParams],
  );

  const clearAll = useCallback(() => {
    setQDraft("");
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const kpiDeepLink = searchParams.get(PROCUREMENT_URL_KEYS.kpi) ?? "";

  const hasActiveFilters = Boolean(
    qDraft.trim() || projectId || itemStatus || requestStatus || kpiDeepLink,
  );

  return {
    query: qDraft,
    setQuery: setQDraft,
    projectId,
    setProjectId,
    itemStatus,
    setItemStatus,
    requestStatus,
    setRequestStatus,
    clearAll,
    hasActiveFilters,
  };
}
