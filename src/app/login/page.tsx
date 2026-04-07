import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MessagesSquare, Sparkles } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Вхід в ENVER CRM",
  description: "ENVER CRM — операційна система для меблів під замовлення.",
};

const cards = [
  {
    icon: CalendarDays,
    title: "Замір заплановано",
    subtitle: "Календар виїздів, монтажів та сервісу.",
  },
  {
    icon: MessagesSquare,
    title: "Єдина переписка",
    subtitle: "Telegram, Instagram та дзвінки в одному місці.",
  },
  {
    icon: Sparkles,
    title: "AI підказує кроки",
    subtitle: "Рекомендації по лідах та проектах.",
  },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--enver-bg)] px-3 py-6 md:px-6">
      <div className="grid w-full max-w-5xl gap-6 rounded-3xl border border-slate-600/50 bg-[var(--enver-card)]/80 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:p-6">
        <section className="relative hidden flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-[#3E2A5A] via-[#2d1d45] to-[#1a1028] px-8 py-8 text-slate-50 shadow-xl md:flex">
          <div className="absolute -left-32 top-10 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/70 ring-1 ring-slate-700/80">
              <span className="text-sm font-semibold tracking-tight">EN</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                ENVER CRM
              </span>
              <span className="text-sm text-slate-200">
                Корпусні меблі · проєкти · сервіс
              </span>
            </div>
          </div>

          <div className="relative mt-8 space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
              Жива CRM для{" "}
              <span className="bg-gradient-to-r from-sky-300 to-emerald-300 bg-clip-text text-transparent">
                меблів під замовлення
              </span>
              .
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">
              Ведіть ліди, заміри, виробництво та монтаж в одному операційному
              просторі. ENVER допомагає не загубити жоден проєкт.
            </p>
          </div>

          <div className="relative mt-8 grid gap-3 text-sm md:grid-cols-2">
            {cards.map((card) => (
              <div
                key={card.title}
                className="group rounded-2xl border border-slate-800/80 bg-slate-900/50 px-3.5 py-3 shadow-sm shadow-black/20 backdrop-blur-sm transition hover:border-sky-500/40 hover:bg-slate-900/70"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800/80 text-slate-200 group-hover:bg-sky-500/20">
                    <card.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-50">
                      {card.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {card.subtitle}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
            <span>
              Операційний контур: ліди → замір → проєкт → виробництво → монтаж
              → сервіс.
            </span>
          </div>
        </section>

        <section className="flex flex-col justify-center rounded-3xl border border-slate-200/90 bg-[var(--enver-bg)] px-4 py-5 shadow-sm md:px-6">
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
