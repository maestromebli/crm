"use client";

import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { SettingsSavePanel } from "../../../../components/settings/SettingsSavePanel";
import { useRegistrySettings } from "../../../../components/settings/useRegistrySettings";

type InboxSettings = {
  botToken: string;
  webhookUrl: string;
  botUsername: string;
  channelId: string;
  autoCreateLead: boolean;
};

const FALLBACK: InboxSettings = {
  botToken: "",
  webhookUrl: "",
  botUsername: "",
  channelId: "",
  autoCreateLead: true,
};

export function InboxSettingsClient() {
  const { data, setData, error, saving, savedAt, save } =
    useRegistrySettings<InboxSettings>("inbox", FALLBACK);

  return (
    <>
      <SettingsCard
        title="Підключення Telegram"
        description="Налаштуйте дані бота, які будуть використані сервером ENVER."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Bot token (BOT_TOKEN)</label>
          <input
            type="password"
            value={data.botToken}
            onChange={(e) =>
              setData((prev) => ({ ...prev, botToken: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="1234567890:AA..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">URL вебхука</label>
          <input
            value={data.webhookUrl}
            onChange={(e) =>
              setData((prev) => ({ ...prev, webhookUrl: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="https://api.envercrm.com/api/telegram/webhook"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Імʼя користувача бота</label>
          <input
            value={data.botUsername}
            onChange={(e) =>
              setData((prev) => ({ ...prev, botUsername: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="@enver_crm_bot"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            ID каналу / чату (необовʼязково)
          </label>
          <input
            value={data.channelId}
            onChange={(e) =>
              setData((prev) => ({ ...prev, channelId: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="Напр. -1001234567890"
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Ці значення зазвичай зберігаються у середовищі змінних оточення
          бекенду (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`).
        </p>
      </SettingsCard>

      <SettingsCard
        title="Автоматичні ліди"
        description="Як створювати ліди з нових діалогів."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Створювати лід з нового відправника
          </label>
          <select
            value={data.autoCreateLead ? "yes" : "no"}
            onChange={(e) =>
              setData((prev) => ({ ...prev, autoCreateLead: e.target.value === "yes" }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          >
            <option value="yes">Так, автоматично</option>
            <option value="no">Ні, лише вручну</option>
          </select>
        </div>
      </SettingsCard>

      <SettingsSavePanel
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={() => void save()}
      />
    </>
  );
}
