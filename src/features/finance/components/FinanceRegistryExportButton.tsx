import { FinanceCsvExportButton } from "./FinanceCsvExportButton";

/** Експорт реєстру об'єктів (`/api/finance/registry/export`). */
export function FinanceRegistryExportButton() {
  return (
    <FinanceCsvExportButton
      apiPath="/api/finance/registry/export"
      fallbackFilename={`finance-registry-${new Date().toISOString().slice(0, 10)}.csv`}
      ariaLabel="Експорт реєстру об'єктів у CSV"
      title="Повний реєстр проєктів з сервера: маржа, борг, зарплатні колонки. UTF-8 BOM — зручно для Excel UA."
    />
  );
}
