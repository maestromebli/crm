"use client";

import Link from "next/link";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { IntegrationConnectionTest } from "../../../../components/settings/IntegrationConnectionTest";
import { SettingsSavePanel } from "../../../../components/settings/SettingsSavePanel";
import { useRegistrySettings } from "../../../../components/settings/useRegistrySettings";

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

export default function SettingsAiPage() {
  const { data: cfg, setData: setCfg, saving, savedAt, error, save } =
    useRegistrySettings<AiSettingsState>("ai", defaultAi);

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
        <div className="mt-3">
          <IntegrationConnectionTest endpoint="/api/integrations/ai" />
          <p className="mt-2 text-[10px] text-slate-500">
            Ендпоінт тесту: <code className="rounded bg-slate-100 px-1">GET /api/integrations/ai</code>
          </p>
        </div>
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
            Підсумок замовлення
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
            Ризики по замовленнях
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
            <span className="font-medium">Замовлення</span> — підсумок замовлення, ризики,
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

      <SettingsSavePanel
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={() => void save()}
      />
    </SettingsShell>
  );
}
