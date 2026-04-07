import type { Metadata } from "next";
import { AiAssistantChat } from "../../../../components/dashboard/AiAssistantChat";
import { DashboardAiSummary } from "../../../../components/dashboard/DashboardAiSummary";
import { ModuleWorkspace } from "../../../../components/module/ModuleWorkspace";

export const metadata: Metadata = {
  title: "AI summary · ENVER CRM",
};

export default function DashboardAiPage() {
  return (
    <ModuleWorkspace pathname="/dashboard/ai">
      <div className="space-y-8">
        <section className="rounded-2xl border border-sky-200/60 bg-gradient-to-br from-sky-50 via-white to-indigo-50/80 px-5 py-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-900/80">
            AI‑огляд дня
          </p>
          <div className="mt-3 max-w-3xl">
            <DashboardAiSummary fallback="Завантаження AI‑огляду…" />
          </div>
        </section>
        <AiAssistantChat />
      </div>
    </ModuleWorkspace>
  );
}
