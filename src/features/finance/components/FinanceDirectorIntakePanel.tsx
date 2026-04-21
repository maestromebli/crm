"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/button";

type ProjectOpt = { id: string; label: string };

type Props = {
  projects: ProjectOpt[];
};

type Tab = "budget" | "payroll" | "contract";

export function FinanceDirectorIntakePanel({ projects }: Props) {
  const [tab, setTab] = useState<Tab>("budget");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [direction, setDirection] = useState("Виробництво");
  const [amount, setAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [deadline, setDeadline] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  function submit() {
    const payload = {
      tab,
      projectId,
      direction,
      amount: Number(amount || 0),
      justification,
      deadline,
      at: new Date().toISOString(),
    };
    try {
      const key = "enver-finance-director-requests";
      const prev = JSON.parse(typeof window !== "undefined" ? localStorage.getItem(key) ?? "[]" : "[]") as unknown[];
      const next = [payload, ...(Array.isArray(prev) ? prev : [])].slice(0, 20);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setSent(
      tab === "budget"
        ? "Заявку на бюджет закупівель надіслано на погодження (локальне демо)."
        : tab === "payroll"
          ? "Запит на виплату / премію передано в фінанси (локальне демо)."
          : "Запит на зміну умов замовлення зареєстровано (локальне демо).",
    );
    setAmount("");
    setJustification("");
  }

  const tabs: { id: Tab; label: string; hint: string }[] = [
    { id: "budget", label: "Бюджет закупівель", hint: "Ліміт по обʼєкту або додаткова партія матеріалів" },
    { id: "payroll", label: "Виплата / премія", hint: "ЗП, бонус бригаді, терміновий аванс" },
    { id: "contract", label: "Умови замовлення", hint: "Зміна строків, обсягу, графіку оплат" },
  ];

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/40 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Керівники напрямів</p>
          <h3 className="text-base font-semibold text-slate-900">Подача заявок у фінанси</h3>
          <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-slate-600">
            Бюджет закупівель, виплати, зміни до замовлення. У демо заявки зберігаються локально в браузері.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSent(null);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-slate-900 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-100">
        {tabs.find((x) => x.id === tab)?.hint}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">
          Напрям
          <select
            className={inputClass}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            {["Виробництво", "Продажі", "Закупівлі", "Монтаж", "Логістика"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">
          Замовлення (проєкт)
          <select
            className={inputClass}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800 sm:col-span-2">
          Сума (грн) або орієнтир
          <input
            className={inputClass}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="text-sm font-medium text-slate-800 sm:col-span-2">
          Обґрунтування
          <textarea
            className={`${inputClass} min-h-[96px] resize-y`}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Коротко: що потрібно, чому зараз, ризик якщо не зробити"
          />
        </label>
        <label className="text-sm font-medium text-slate-800 sm:col-span-2">
          Бажаний дедлайн рішення
          <input
            className={inputClass}
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <Button type="button" onClick={submit} className="rounded-xl px-5">
          Надіслати на погодження
        </Button>
        {sent ? (
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900 ring-1 ring-emerald-200/80">{sent}</span>
        ) : null}
      </div>
    </div>
  );
}
