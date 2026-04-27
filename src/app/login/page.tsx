import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Вхід в ENVER CRM",
  description: "ENVER CRM — операційна система для меблів під замовлення.",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--enver-bg)] px-3 py-6 md:px-6">
      <div className="grid w-full max-w-5xl gap-6 rounded-3xl border border-slate-600/50 bg-[var(--enver-card)]/80 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:p-6">
        <section className="login-hero-panel relative z-0 hidden overflow-hidden rounded-3xl border border-slate-700/70 px-8 py-8 text-slate-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_24px_56px_rgba(0,0,0,0.5)] md:w-[700px] md:-mr-24 md:flex md:flex-col md:justify-between md:pr-28">
          <div className="login-hero-panel-overlay pointer-events-none absolute inset-0" />

          <div className="relative flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/70 ring-1 ring-slate-700/80">
              <span className="text-sm font-semibold tracking-tight">EN</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                ENVER CRM
              </span>
              <span className="text-sm text-slate-300">
                CRM-ERP System OS
              </span>
            </div>
          </div>

          <div className="relative my-8 flex-1" />

          <div className="relative flex items-center gap-2 text-xs text-slate-400">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.75)]" />
            <span>Єдина система для управління бізнесом та зростання компанії.</span>
          </div>
        </section>

        <section className="login-auth-shell relative z-10 flex flex-col justify-center rounded-3xl border border-slate-200/90 bg-[var(--enver-bg)] px-4 py-5 shadow-sm md:px-6">
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3E2A5A] text-white">
              <span className="text-sm font-semibold tracking-tight">EN</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                ENVER CRM
              </span>
              <span className="text-xs text-slate-600">
                Корпусні меблі · проєкти · сервіс
              </span>
            </div>
          </div>

          <LoginForm />
        </section>
      </div>
    </main>
  );
}
