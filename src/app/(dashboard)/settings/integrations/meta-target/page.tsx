import type { Metadata } from "next";
import Link from "next/link";
import { SettingsShell } from "../../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../../components/settings/SettingsCard";

export const metadata: Metadata = {
  title: "Instagram / Meta таргет · ENVER CRM",
};

const META_DOCS = "https://developers.facebook.com/docs/marketing-api/";
const LEAD_DOCS =
  "https://developers.facebook.com/docs/marketing-api/guides/lead-ads/";

export default function SettingsMetaTargetPage() {
  return (
    <SettingsShell
      title="Instagram / Meta таргет"
      description="Підключення рекламного кабінету Meta: кампанії в Instagram і Facebook, лід-форми та імпорт звернень у CRM."
    >
      <SettingsCard
        title="Операційна робота з рекламою"
        description="Кампанії, витрати та ліди — у окремому модулі."
      >
        <p className="text-[11px] text-slate-600">
          Щоденний перегляд KPI, таблиць і синхронізації:{" "}
          <Link
            href="/target"
            className="font-medium text-orange-800 underline underline-offset-2 hover:text-orange-950"
          >
            розділ «Таргет»
          </Link>
          .
        </p>
      </SettingsCard>

      <SettingsCard
        title="Навіщо це в CRM"
        description="Окремо від повідомлень Instagram Direct (їх дивіться у Вхідні)."
      >
        <ul className="list-inside list-disc space-y-1 text-[11px] text-slate-600">
          <li>заявки з лід-форм Meta (Lead Ads) як ліди з мітками кампанії та набору оголошень;</li>
          <li>звʼязок джерела «Реклама / Instagram» з UTM і назвами кампаній у картці ліда;</li>
          <li>подальша синхронізація витрат і конверсій — за наявності підключення Marketing API.</li>
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Передумови в Meta"
        description="Що має бути налаштовано у Business Manager до введення ключів тут."
      >
        <ol className="list-inside list-decimal space-y-1.5 text-[11px] text-slate-600">
          <li>
            Бізнес-акаунт і рекламний акаунт (Ad Account) з доступом до Instagram і
            Facebook-сторінки.
          </li>
          <li>
            Застосунок Meta (Facebook App) з продуктом Marketing API та дозволами на ads_read,
            leads_retrieval (за потреби — business_management).
          </li>
          <li>
            Для лід-форм: активні форми в рекламі або Instant Forms; вебхук для Lead Ads на
            бекенд ENVER (endpoint задає розробка).
          </li>
        </ol>
      </SettingsCard>

      <SettingsCard
        title="Параметри підключення"
        description="Значення зазвичай зберігаються в змінних оточення сервера; тут — для перевірки та передачі адміністратору."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Meta App ID" placeholder="Напр. 1234567890123456" />
          <Field label="Ad Account ID" placeholder="act_…" />
          <Field label="Pixel ID (опційно)" placeholder="Для веб-конверсій" />
          <Field label="Instagram Business Account ID" placeholder="З Business Manager" />
        </div>
        <div className="mt-2 space-y-2">
          <Field
            label="App Secret / System User token"
            type="password"
            placeholder="Не зберігайте в чатах — лише в секретах сервера"
          />
          <Field
            label="Довгоживучий access token (Marketing API)"
            type="password"
            placeholder="Long-lived token з потрібними scopes"
          />
        </div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-2 text-[10px] text-slate-500">
          <span className="font-medium text-slate-600">Webhook (Lead Ads): </span>
          URL та verify token видаються після деплою API; у формі лід-форми вкажіть той самий
          endpoint, що налаштований у Meta.
        </div>
      </SettingsCard>

      <SettingsCard title="Чеклист запуску" description="Короткий порядок роботи з таргетом.">
        <ol className="list-inside list-decimal space-y-1.5 text-[11px] text-slate-600">
          <li>Перевірити права користувача в Business Manager на рекламу та сторінку.</li>
          <li>Згенерувати токен з потрібними дозволами та передати в безпечне сховище.</li>
          <li>У рекламі додати лід-форму та підписати вебхук на імпорт у CRM.</li>
          <li>У CRM задати джерело/воронку для лідів з Meta (узгодити з полем «Джерело»).</li>
        </ol>
      </SettingsCard>

      <SettingsCard title="Документація Meta">
        <p className="text-[11px] text-slate-600">
          Офіційні гайди:{" "}
          <Link
            href={META_DOCS}
            className="text-orange-700 underline underline-offset-2 hover:text-orange-900"
            target="_blank"
            rel="noreferrer"
          >
            Marketing API
          </Link>
          ,{" "}
          <Link
            href={LEAD_DOCS}
            className="text-orange-700 underline underline-offset-2 hover:text-orange-900"
            target="_blank"
            rel="noreferrer"
          >
            Lead Ads
          </Link>
          .
        </p>
      </SettingsCard>
    </SettingsShell>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
}: {
  label: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-slate-600">{label}</label>
      <input
        type={type}
        className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-xs outline-none focus:border-slate-900"
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}
