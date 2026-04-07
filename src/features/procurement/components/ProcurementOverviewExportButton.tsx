"use client";

import { Download } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { buildProcurementCsvString, procurementCsvHasRows, type ProcurementCsvPayload } from "../lib/build-procurement-csv";

type Props = ProcurementCsvPayload & {
  /** Ім’я файлу без шляху; за замовчуванням — огляд з датою. */
  downloadFilename?: string;
};

/** Зведений CSV закупівель (секції — як у модулі). */
export function ProcurementOverviewExportButton({ downloadFilename, ...payload }: Props) {
  const download = () => {
    const body = buildProcurementCsvString(payload);
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      downloadFilename ?? `zakupivli-ohliad-${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasData = procurementCsvHasRows(payload);
  const title = hasData
    ? "Один CSV: заявки, позиції, PO, постачальники, поставки — для аналізу та архіву в Excel."
    : "Немає рядків для експорту: додайте заявки, позиції, PO або постачальників.";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={download}
      disabled={!hasData}
      title={title}
      aria-label={hasData ? "Експорт закупівель у CSV" : "Експорт недоступний — немає даних"}
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      Експорт CSV
    </Button>
  );
}
