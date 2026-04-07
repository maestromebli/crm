"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { procurementKpiScrollTargetId } from "../lib/kpi-deeplink";

/** Після переходу з KPI-картки скролить до відповідної секції таблиць. */
export function ProcurementKpiDeepLinkScroll() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const k = searchParams.get("kpi");
    const id = procurementKpiScrollTargetId(k);
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [searchParams]);

  return null;
}
