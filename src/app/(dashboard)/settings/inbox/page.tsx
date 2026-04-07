import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";

export const metadata: Metadata = {
  title: "Вхідні / Telegram · ENVER CRM",
};

export default function SettingsInboxPage() {
  return (
    <SettingsShell
      title="Вхідні / Telegram"
      description="Підключіть Telegram та задайте правила роботи inbox."
    >
      <SettingsCard
        title="Підключення Telegram"
        description="Налаштуйте дані бота, які будуть використані сервером ENVER."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Bot token (BOT_TOKEN)
          </label>
          <input
            type="password"
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="1234567890:AA..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            URL вебхука
          </label>
          <input
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="https://api.envercrm.com/api/telegram/webhook"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Імʼя користувача бота
          </label>
          <input
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="@enver_crm_bot"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            ID каналу / чату (необовʼязково)
          </label>
          <input
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            placeholder="Напр. -1001234567890"
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Ці значення зазвичай зберігаються у середовищі змінних
          оточення бекенду (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`).
        </p>
        <button className="mt-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-50 shadow-sm shadow-slate-900/40">
          Зберегти налаштування
        </button>
      </SettingsCard>

      <SettingsCard
        title="Автоматичні ліди"
        description="Як створювати ліди з нових діалогів."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Створювати лід з нового відправника
          </label>
          <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
            <option>Так, автоматично</option>
            <option>Ні, лише вручну</option>
          </select>
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}

