import { FinanceCsvExportButton } from "./FinanceCsvExportButton";

/** Експорт PayrollEntry (`/api/finance/payroll/export`). */
export function FinancePayrollExportButton() {
  return (
    <FinanceCsvExportButton
      apiPath="/api/finance/payroll/export"
      fallbackFilename={`payroll-${new Date().toISOString().slice(0, 10)}.csv`}
      ariaLabel="Експорт нарахувань зарплати у CSV"
      title="Нарахування та виплати зарплати — вигрузка з сервера для звірки та обліку."
    />
  );
}
