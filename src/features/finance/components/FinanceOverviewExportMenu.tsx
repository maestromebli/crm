"use client";

import { ChevronDown, Download as Завантажити, Server } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  buildFinanceOverviewCsvString,
  FINANCE_OVERVIEW_CSV_MAX_TRANSACTIONS,
  type FinanceOverviewCsvPayload,
} from "../lib/build-finance-overview-csv";

type Props = FinanceOverviewCsvPayload & {
  downloadFilename?: string;
};

/**
 * Один контроль експорту з поясненням режимів: швидкий (браузер, ліміт рядків) і повний (API, усі транзакції).
 */
export function FinanceOverviewExportMenu({ downloadFilename, ...payload }: Props) {
  const txTotal = payload.transactions.length;
  const overBrowserCap = txTotal > FINANCE_OVERVIEW_CSV_MAX_TRANSACTIONS;

  const downloadQuick = () => {
    const { csv } = buildFinanceOverviewCsvString(payload);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename ?? `finansy-ohliad-${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          aria-haspopup="menu"
          aria-label="Експорт огляду фінансів у CSV — відкрити варіанти"
        >
          <Завантажити className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Експорт CSV
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(calc(100vw-2rem),20rem)] p-2">
        <DropdownMenuLabel className="mb-1 px-1 text-[11px] font-normal leading-snug text-slate-600">
          Один файл: KPI портфелю, графік оплат і таблиця транзакцій. Оберіть, як сформувати список транзакцій.
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mb-1" />
        <DropdownMenuItem
          className="cursor-pointer flex-col items-stretch gap-1 rounded-md px-2 py-2.5 focus:bg-violet-50"
          onSelect={(e) => {
            e.preventDefault();
            downloadQuick();
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--enver-text)]">
            <Завантажити className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
            Швидкий (у браузері)
          </div>
          <p className="pl-6 text-[11px] leading-snug text-slate-600">
            До {FINANCE_OVERVIEW_CSV_MAX_TRANSACTIONS.toLocaleString("uk-UA")} рядків транзакцій — зазвичай достатньо
            для аналізу. Без навантаження на сервер.
            {overBrowserCap
              ? ` Зараз у базі ${txTotal.toLocaleString("uk-UA")} — у файлі буде перші ${FINANCE_OVERVIEW_CSV_MAX_TRANSACTIONS.toLocaleString("uk-UA")}.`
              : ""}
          </p>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem className="cursor-pointer rounded-md p-0 focus:bg-transparent" asChild>
          <a
            href="/api/finance/overview/export"
            className="flex flex-col gap-1 rounded-md px-2 py-2.5 outline-none hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--enver-text)]">
              <Server className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
              Повний (через сервер)
            </div>
            <p className="pl-6 text-[11px] leading-snug text-slate-600">
              Усі {txTotal.toLocaleString("uk-UA")} транзакцій у тому ж форматі — для аудиту, великих вибірок і повного
              зіставлення з обліком.
            </p>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
