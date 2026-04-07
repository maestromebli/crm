import { FinanceCsvExportButton } from "./FinanceCsvExportButton";

/** Експорт BankIntegration (`/api/finance/banking/export`). */
export function FinanceBankingExportButton() {
  return (
    <FinanceCsvExportButton
      apiPath="/api/finance/banking/export"
      fallbackFilename={`bank-integrations-${new Date().toISOString().slice(0, 10)}.csv`}
      ariaLabel="Експорт списку банківських інтеграцій у CSV"
      title="Список підключених рахунків і статусів синхронізації — для аудиту та налаштувань."
    />
  );
}
