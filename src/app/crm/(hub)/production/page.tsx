import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { getProductionCommandCenter } from "@/features/production/server/queries/get-production-command-center";

const ProductionCommandCenterPage = dynamic(
  () =>
    import("@/features/production/ui/command-center/ProductionCommandCenterPage").then((mod) => ({
      default: mod.ProductionCommandCenterPage,
    })),
  {
    loading: () => (
      <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-6 text-sm text-[var(--enver-text-muted)]">
        Завантажуємо командний центр виробництва...
      </section>
    ),
  },
);

const AiV2InsightCard = dynamic(
  () =>
    import("@/features/ai-v2").then((mod) => ({
      default: mod.AiV2InsightCard,
    })),
  {
    loading: () => (
      <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4 text-xs text-[var(--enver-text-muted)]">
        Завантажуємо AI V2...
      </section>
    ),
  },
);

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
    <main className="enver-page-shell mx-auto max-w-[1700px] space-y-6 p-4 md:p-6">
      <details className="rounded-2xl">
        <summary className="cursor-pointer rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-3 text-sm font-medium text-[var(--enver-text)]">
          AI V2: рекомендації для виробництва
        </summary>
        <div className="mt-3">
          <AiV2InsightCard context="production" />
        </div>
      </details>
      <ProductionCommandCenterPage data={data} />
    </main>
  );
}
