import type { Metadata } from "next";
import Link from "next/link";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { CommunicationsSettingsClient } from "./CommunicationsSettingsClient";

export const metadata: Metadata = {
  title: "Месенджери та телефонія · ENVER CRM",
};

function formatInstagramOauthReason(reason?: string): string | null {
  if (!reason) return null;
  switch (reason) {
    case "missing_app_env":
      return "Не налаштовані INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET у .env.local";
    case "missing_oauth_params":
      return "Meta не повернула обов'язкові OAuth-параметри";
    case "invalid_state":
      return "Невалідний OAuth state (можливо, протермінована або чужа сесія)";
    case "token_exchange_failed":
      return "Не вдалося обміняти OAuth-код на токен доступу";
    default:
      return reason;
  }
}

export default async function SettingsCommunicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ instagramOAuth?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const oauthState = params?.instagramOAuth;
  const oauthReason = params?.reason;
  const oauthReasonLabel = formatInstagramOauthReason(oauthReason);

  return (
    <SettingsShell
      title="Месенджери та телефонія"
      description="Персональні підключення менеджерів (Telegram/WhatsApp/Viber/SMS/телефонія) і спільна Instagram/Facebook-сторінка компанії. Секрети не повертаються після збереження."
    >
      <SettingsCard
        title="Швидкий вхід Instagram (як у KeyCRM)"
        description="Підключення через Meta OAuth: натисніть кнопку, авторизуйтесь, і CRM автоматично збереже токен сторінки та ID Instagram Business."
      >
        <div className="space-y-2 text-[11px]">
          <a
            href="/api/integrations/instagram/oauth/start"
            className="inline-flex rounded-full border border-slate-900 px-3 py-1 font-medium text-slate-900 hover:bg-slate-100"
          >
            Увійти через Instagram / Facebook
          </a>
          {oauthState === "ok" ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-900">
              Instagram успішно підключено через OAuth.
            </p>
          ) : null}
          {oauthState === "failed" || oauthState === "denied" ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-900">
              Не вдалося підключити Instagram
              {oauthReasonLabel ? `: ${oauthReasonLabel}` : ""}.
            </p>
          ) : null}
        </div>
      </SettingsCard>
      <SettingsCard
        title="Режими підключення"
        description="Використовуйте обидва сценарії: персональні канали на співробітників та спільну сторінку Instagram/Facebook."
      >
        <div className="space-y-1 text-[11px] text-slate-600">
          <p>
            Персональні підключення співробітників:{" "}
            <Link
              href="/settings/communications/users"
              className="underline underline-offset-2"
            >
              /settings/communications/users
            </Link>
          </p>
          <p>
            Спільна сторінка Instagram/Facebook налаштовується нижче в цьому
            розділі.
          </p>
        </div>
      </SettingsCard>
      <CommunicationsSettingsClient />
    </SettingsShell>
  );
}
