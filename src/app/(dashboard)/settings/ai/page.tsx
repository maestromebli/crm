"use client";

import { useState } from "react";
import Link from "next/link";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";

type AiSettingsState = {
  apiKey: string;
  baseUrl: string;
  model: string;
  leadSummary: boolean;
  dealSummary: boolean;
  inboxSummary: boolean;
  nextSteps: boolean;
  risks: boolean;
};

const defaultAi: AiSettingsState = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  leadSummary: true,
  dealSummary: true,
  inboxSummary: true,
  nextSteps: false,
  risks: false,
};

function loadAiFromStorage(): AiSettingsState {
  if (typeof window === "undefined") return defaultAi;
  const raw = window.localStorage.getItem("enver_ai_settings");
  if (!raw) return defaultAi;
  try {
    const parsed = JSON.parse(raw) as Partial<AiSettingsState>;
    return {
      ...defaultAi,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : defaultAi.apiKey,
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : defaultAi.baseUrl,
      model: typeof parsed.model === "string" ? parsed.model : defaultAi.model,
      leadSummary:
        typeof parsed.leadSummary === "boolean"
          ? parsed.leadSummary
          : defaultAi.leadSummary,
      dealSummary:
        typeof parsed.dealSummary === "boolean"
          ? parsed.dealSummary
          : defaultAi.dealSummary,
      inboxSummary:
        typeof parsed.inboxSummary === "boolean"
          ? parsed.inboxSummary
          : defaultAi.inboxSummary,
      nextSteps:
        typeof parsed.nextSteps === "boolean"
          ? parsed.nextSteps
          : defaultAi.nextSteps,
      risks: typeof parsed.risks === "boolean" ? parsed.risks : defaultAi.risks,
    };
  } catch {
    return defaultAi;
  }
}

export default function SettingsAiPage() {
  const [cfg, setCfg] = useState<AiSettingsState>(() => loadAiFromStorage());
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const handleSave = () => {
    if (typeof window === "undefined") return;
    setSaving(true);
    window.localStorage.setItem("enver_ai_settings", JSON.stringify(cfg));
    setSavedHint("AI‑налаштування збережено локально.");
    setTimeout(() => {
      setSaving(false);
    }, 300);
  };

  return (
    <SettingsShell
      title="AI‑налаштування"
      description="Керуйте можливостями ШІ в ENVER: підсумки, підказки, ризики."
    >
      <SettingsCard
        title="Підключення AI‑провайдера"
        description="Базові параметри підключення до AI‑API (наприклад, OpenAI або інший провайдер)."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Ключ API
          </label>
          <input
            type="password"
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="sk-..."
            value={cfg.apiKey}
            onChange={(e) =>
              setCfg((c) => ({ ...c, apiKey: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Базова URL (необовʼязково)
          </label>
          <input
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="https://api.openai.com/v1"
            value={cfg.baseUrl}
            onChange={(e) =>
              setCfg((c) => ({ ...c, baseUrl: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Модель за замовчуванням
          </label>
          <input
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="gpt-4.1-mini"
            value={cfg.model}
            onChange={(e) =>
              setCfg((c) => ({ ...c, model: e.target.value }))
            }
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          У реальній системі ці значення зберігаються як змінні
          середовища бекенду (`AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`).
        </p>
      </SettingsCard>

      <SettingsCard
        title="Функції AI"
        description="Оберіть, де саме AI допомагає команді."
      >
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={cfg.leadSummary}
              onChange={(e) =>
                setCfg((c) => ({ ...c, leadSummary: e.target.checked }))
              }
            />{" "}
            Lead summary
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={cfg.dealSummary}
              onChange={(e) =>
                setCfg((c) => ({ ...c, dealSummary: e.target.checked }))
              }
            />{" "}
            Підсумок угоди
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={cfg.inboxSummary}
              onChange={(e) =>
                setCfg((c) => ({ ...c, inboxSummary: e.target.checked }))
              }
            />{" "}
            AI-огляд вхідних
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={cfg.nextSteps}
              onChange={(e) =>
                setCfg((c) => ({ ...c, nextSteps: e.target.checked }))
              }
            />{" "}
            Наступні кроки / рекомендації
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={cfg.risks}
              onChange={(e) =>
                setCfg((c) => ({ ...c, risks: e.target.checked }))
              }
            />{" "}
            Ризики по угодах
          </label>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Де використовується AI"
        description="Огляд модулів ENVER CRM, які використовують AI‑налаштування."
      >
        <ul className="space-y-1 text-[11px] text-slate-700">
          <li>
            <span className="font-medium">Ліди</span> — підсумок ліда,
            наступні кроки у картці.
          </li>
          <li>
            <span className="font-medium">Угоди</span> — підсумок угоди, ризики,
            рекомендації за стадією та наступні кроки.
          </li>
          <li>
            <span className="font-medium">Вхідні</span> — AI-огляд діалогів,
            підказки щодо відповіді.
          </li>
          <li>
            <span className="font-medium">Дашборд</span> — AI-огляд дня та
            критичні елементи.
          </li>
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Адмін-чат з AI"
        description="Окремий системний чат для адміністратора: аудит CRM, пропозиції покращень, шаблони промптів та план розвитку."
      >
        <p className="text-[11px] text-slate-700">
          Для стратегічної роботи з системою відкрийте AI-архітектора CRM у налаштуваннях.
        </p>
        <Link
          href="/settings/ai/admin"
          className="mt-2 inline-flex rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-900 hover:bg-indigo-100"
        >
          Відкрити AI-архітектора CRM
        </Link>
      </SettingsCard>

      <div className="flex items-center justify-between pt-2 text-[11px]">
        <p className="text-slate-500">
          Ці налаштування зараз зберігаються лише локально у браузері.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-slate-900 px-4 py-1.5 text-slate-50 shadow-sm shadow-slate-900/40 disabled:opacity-60"
        >
          {saving ? "Зберігаю…" : "Зберегти AI‑налаштування"}
        </button>
      </div>
      {savedHint && (
        <p className="pt-1 text-[10px] text-emerald-600">
          {savedHint}
        </p>
      )}
    </SettingsShell>
  );
}
