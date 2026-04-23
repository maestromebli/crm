"use client";

import { Download as Завантажити } from "lucide-react";
import { postJson } from "@/lib/api/patch-json";
import { Button } from "../../../components/ui/button";
import { buildFinanceProjectCsvString, type FinanceProjectCsvPayload } from "../lib/build-finance-project-csv";

type Props = FinanceProjectCsvPayload & {
  downloadFilename?: string;
  /** Підпис для скрінрідерів. */
  ariaLabel?: string;
};

/** Експорт фінансової картки проєкту в один CSV (UTF-8 BOM). */
export function FinanceProjectExportButton({
  downloadFilename,
  ariaLabel = "Експорт фінансової картки проєкту у CSV",
  ...payload
}: Props) {
  const download = () => {
    const body = buildFinanceProjectCsvString(payload);
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      downloadFilename ?? `finansy-proiektu-${payload.projectCode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);

    void postJson<{ ok?: boolean }>(
      "/api/finance/log-export",
      {
        kind: "project",
        projectId: payload.projectId ?? "",
        projectCode: payload.projectCode,
      },
      { credentials: "same-origin" },
    ).catch(() => {});
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={download}
      aria-label={ariaLabel}
      title="Зведення по проєкту в одному файлі: підсумки, витрати по статтях, ЗП, графік оплат, транзакції (UTF-8 BOM)."
    >
      <Завантажити className="h-3.5 w-3.5" aria-hidden />
      Експорт CSV
    </Button>
  );
}
