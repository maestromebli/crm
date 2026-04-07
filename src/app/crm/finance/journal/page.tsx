import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { FinanceJournalClient } from "@/features/finance/components/FinanceJournalClient";

export default function FinanceJournalPage() {
  return (
    <main className="mx-auto max-w-[min(100%,1200px)] space-y-6 px-4 py-5 sm:px-6">
      <PageHeader
        title="Журнал проводок"
        subtitle="Подвійний запис: план рахунків та проводки з балансом дебет / кредит."
        actionsSlot={
          <Link
            href="/crm/finance"
            className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            ← Огляд фінансів
          </Link>
        }
      />
      <FinanceJournalClient />
    </main>
  );
}
