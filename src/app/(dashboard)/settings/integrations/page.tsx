import type { Metadata } from "next";
import Link from "next/link";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { P, requirePermissionForPage } from "../../../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "Інтеграції · ENVER CRM",
};

export default async function SettingsIntegrationsPage() {
  await requirePermissionForPage(P.ROLES_MANAGE);

  return (
    <SettingsShell
      title="Інтеграції"
      description="Підключення зовнішніх сервісів: пошта, календар, месенджери, Meta Ads (таргет), бухгалтерія, склад."
    >
      <p className="text-[11px] text-slate-500">
        Для кожної нової інтеграції обовʼязковий міні-тест підключення через API (кнопка перевірки на сторінці інтеграції).
      </p>
      <SettingsCard
        title="Каталог"
        description="Статус зʼєднання, остання синхронізація, помилки."
      >
        <ul className="space-y-2 text-[11px] text-slate-600">
          <li className="flex items-center justify-between rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-2">
            <span>Google Календар</span>
            <span className="text-amber-700">Не підключено</span>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-2">
            <span>Telegram-бот</span>
            <span className="text-slate-500">Див. Вхідні / Telegram</span>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-2">
            <span>Директ Instagram</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-500">
              <Link
                className="text-slate-600 underline underline-offset-2 hover:text-[var(--enver-text)]"
                href="/settings/communications"
              >
                Загальна сторінка
              </Link>
              <span className="text-slate-300">·</span>
              <Link
                className="text-slate-600 underline underline-offset-2 hover:text-[var(--enver-text)]"
                href="/settings/communications/users"
              >
                По співробітниках
              </Link>
            </span>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-2">
            <span>GitLab</span>
            <Link
              className="text-slate-600 underline underline-offset-2 hover:text-[var(--enver-text)]"
              href="/settings/integrations/gitlab"
            >
              API та перевірка токена
            </Link>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-2">
            <span>Meta Ads (Instagram / Facebook таргет)</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-500">
              <Link
                className="text-orange-700 underline underline-offset-2 hover:text-orange-900"
                href="/target"
              >
                Розділ «Таргет»
              </Link>
              <span className="text-slate-300">·</span>
              <Link
                className="text-slate-600 underline underline-offset-2 hover:text-[var(--enver-text)]"
                href="/settings/integrations/meta-target"
              >
                Ключі API
              </Link>
            </span>
          </li>
        </ul>
      </SettingsCard>
    </SettingsShell>
  );
}
