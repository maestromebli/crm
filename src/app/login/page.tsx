import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Вхід в ENVER CRM",
  description: "ENVER CRM — операційна система для меблів під замовлення.",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--enver-bg)] px-3 py-6 md:px-6">
      <div className="login-dynamic-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="login-bg-wave login-bg-wave-1" />
        <span className="login-bg-wave login-bg-wave-2" />
        <span className="login-bg-wave login-bg-wave-3" />
        <span className="login-bg-wave login-bg-wave-4" />
        <span className="login-bg-sparkle" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl gap-6 rounded-3xl border border-slate-600/50 bg-[var(--enver-card)]/80 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:p-6">
        <section className="login-hero-panel relative z-0 hidden overflow-hidden rounded-3xl border border-slate-700/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_24px_56px_rgba(0,0,0,0.5)] md:w-[700px] md:-mr-24 md:flex">
          <div className="login-hero-panel-overlay pointer-events-none absolute inset-0" />
          <Image
            src="/login-hero-wall-light.png"
            alt=""
            fill
            priority
            className="login-hero-image login-hero-image-light object-cover object-center"
          />
          <Image
            src="/login-hero-wall.png"
            alt=""
            fill
            priority
            className="login-hero-image login-hero-image-dark object-cover object-center"
          />
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
