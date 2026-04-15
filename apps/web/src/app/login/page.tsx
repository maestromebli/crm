import type { Metadata } from "next";
import { LoginAssistantPanel } from "./LoginAssistantPanel";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Вхід в ENVER CRM",
  description: "Enver CRM – операційна система для меблів під замовлення."
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-3 py-6 md:px-6">
      <div className="grid w-full max-w-5xl gap-6 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-[0_22px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:p-6">
        <section className="hidden md:block">
          <LoginAssistantPanel />
        </section>

        <section className="flex flex-col justify-center rounded-3xl border border-slate-100 bg-slate-50/70 px-4 py-5 shadow-sm md:px-6">
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-slate-50">
              <span className="text-sm font-semibold tracking-tight">EN</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Enver CRM
              </span>
              <span className="text-xs text-slate-600">
                Корпусні меблі · проекти · сервіс
              </span>
            </div>
          </div>

          <LoginForm devHint="dev-admin" />
        </section>
      </div>
    </main>
  );
}

