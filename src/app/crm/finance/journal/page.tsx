import { PageHeader } from "@/components/shared/PageHeader";
import { FinanceJournalClient } from "@/features/finance/components/FinanceJournalClient";
import { hasUnrestrictedPermissionScope } from "@/lib/authz/permissions";
import { getCachedServerSession } from "@/lib/authz/server-session";
import { redirect } from "next/navigation";

export default async function FinanceJournalPage() {
  const session = await getCachedServerSession();
  const hasUnrestricted = hasUnrestrictedPermissionScope({
    realRole: session?.user?.realRole,
    impersonatorId: session?.user?.impersonatorId,
  });
  if (
    !hasUnrestricted &&
    session?.user?.realRole !== "ACCOUNTANT" &&
    session?.user?.realRole !== "PROCUREMENT_MANAGER"
  ) {
    redirect("/access-denied");
  }

  return (
    <main className="mx-auto max-w-[min(100%,1200px)] space-y-6 px-4 py-5 sm:px-6">
      <PageHeader
        title="Журнал проводок"
        subtitle="Подвійний запис: план рахунків та проводки з балансом дебет / кредит."
      />
      <FinanceJournalClient />
    </main>
  );
}
