import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { getProductionCommandCenter } from "@/features/production/server/queries/get-production-command-center";
import { ProductionCommandCenterPage } from "@/features/production/ui/command-center/ProductionCommandCenterPage";

export const metadata: Metadata = {
  title: "Штаб виробництва · ENVER CRM",
  description: "Операційний центр контролю виробничого потоку.",
};

export default async function CrmProductionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  const data = await getProductionCommandCenter({ session });
  if (!data) {
    redirect("/access-denied");
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <ProductionCommandCenterPage data={data} />
    </main>
  );
}
