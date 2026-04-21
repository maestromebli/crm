import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";

export const metadata: Metadata = {
  title: "Воронки та стадії · ENVER CRM",
};

export default function SettingsPipelinesPage() {
  return (
    <SettingsShell
      title="Воронки та стадії"
      description="Налаштуйте воронки продажів, виробництва та передачі у виробництво, а також їхні стадії."
    >
      <SettingsCard
        title="Воронка продажів"
        description="Базова воронка для замовлень ENVER CRM."
      >
        <ol className="list-decimal space-y-0.5 pl-4 text-[11px] text-slate-700">
          <li>Новий лід</li>
          <li>Кваліфікація</li>
          <li>КП надіслано</li>
          <li>Переговори</li>
          <li>Договір / передоплата</li>
          <li>Передача → виробництво</li>
          <li>Монтаж</li>
          <li>Закрито / успішно</li>
        </ol>
      </SettingsCard>

      <SettingsCard
        title="Додати воронку"
        description="Створіть окрему воронку для B2B, сервісних заявок чи партнерських проектів."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Назва воронки
          </label>
          <input className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Тип сутності
          </label>
          <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
            <option>Замовлення</option>
            <option>Виробництво</option>
            <option>Передача</option>
          </select>
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}

