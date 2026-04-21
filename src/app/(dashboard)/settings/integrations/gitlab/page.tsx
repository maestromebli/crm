import type { Metadata } from "next";
import Link from "next/link";
import { SettingsShell } from "../../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../../components/settings/SettingsCard";
import { GitLabIntegrationTest } from "../../../../../components/settings/GitLabIntegrationTest";
import { requirePermissionForPage } from "../../../../../lib/authz/page-auth";
import { P } from "../../../../../lib/authz/permissions";

export const metadata: Metadata = {
  title: "GitLab · Інтеграції · ENVER CRM",
};

const GITLAB_TOKEN_DOCS = "https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html";

export default async function SettingsGitLabPage() {
  await requirePermissionForPage(P.SETTINGS_VIEW);
  return (
    <SettingsShell
      title="GitLab"
      description="Підключення до GitLab (self-managed або GitLab.com) через REST API: перевірка токена, подальші сценарії — задачі, пайплайни, посилання на репозиторії."
    >
      <p className="text-[11px] text-slate-500">
        <Link href="/settings/integrations" className="text-slate-600 underline underline-offset-2">
          ← До інтеграцій
        </Link>
      </p>

      <SettingsCard
        title="Змінні оточення сервера"
        description="Ключі не зберігаються в базі CRM — лише на сервері застосунку (наприклад .env.local або секрети хостингу)."
      >
        <ul className="list-inside list-disc space-y-1 text-[11px] text-slate-600">
          <li>
            <code className="rounded bg-slate-100 px-1">GITLAB_BASE_URL</code> — базова адреса інстансу,
            наприклад <code className="rounded bg-slate-100 px-1">https://gitlab.com</code> або ваш
            корпоративний хост.
          </li>
          <li>
            <code className="rounded bg-slate-100 px-1">GITLAB_TOKEN</code> — персональний токен доступу
            або project/group token з мінімальними правами: <code className="rounded bg-slate-100 px-1">read_api</code>{" "}
            (для перевірки <code className="rounded bg-slate-100 px-1">/api/v4/user</code>).
          </li>
        </ul>
        <p className="mt-2 text-[11px] text-slate-600">
          Документація токенів:{" "}
          <a
            href={GITLAB_TOKEN_DOCS}
            className="text-orange-800 underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            GitLab — персональні токени доступу
          </a>
          .
        </p>
      </SettingsCard>

      <SettingsCard
        title="Перевірка API"
        description="Викликає GET /api/v4/user та /api/v4/version з серверного бекенду CRM."
      >
        <GitLabIntegrationTest />
      </SettingsCard>

      <SettingsCard
        title="Подальший розвиток"
        description="Після успішної перевірки можна додати вебхуки, створення задач з замовлень, статуси пайплайнів по проєкту."
      >
        <p className="text-[11px] text-slate-600">
          Ендпоінт для тесту: <code className="rounded bg-slate-100 px-1">GET /api/integrations/gitlab</code>{" "}
          (потрібне право перегляду налаштувань).
        </p>
      </SettingsCard>
    </SettingsShell>
  );
}
