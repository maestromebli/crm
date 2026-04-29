import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Умови використання | ENVER CRM",
  description:
    "Умови використання платформи ENVER CRM відповідно до законодавства України.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--enver-bg)] px-4 py-8 text-[var(--enver-text)] md:px-8">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200/80 bg-[var(--enver-card)] p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold md:text-3xl">Умови використання ENVER CRM</h1>
        <p className="mt-2 text-sm text-slate-500">
          Останнє оновлення: 29.04.2026
        </p>

        <section className="mt-6 space-y-3 text-sm leading-6 text-slate-700">
          <p>
            Ці Умови використання регулюють доступ і користування вебзастосунком ENVER CRM (далі
            — «Сервіс») та укладаються між Користувачем і Володільцем Сервісу. Продовжуючи
            використання Сервісу, Користувач підтверджує ознайомлення та згоду з цими Умовами.
          </p>
          <p>
            Умови сформовані з урахуванням вимог Цивільного кодексу України, Закону України «Про
            електронну комерцію», Закону України «Про захист прав споживачів» (у застосовній
            частині) та інших актів законодавства України.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">1. Предмет та призначення Сервісу</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Сервіс надає інструменти CRM/ERP для обліку лідів, угод, замовлень і документів.</li>
            <li>Функціонал може змінюватись, доповнюватись або обмежуватись з технічних причин.</li>
            <li>Використання Сервісу дозволено лише в межах законодавства України.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">2. Реєстрація та обліковий запис</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Користувач зобовʼязаний надавати достовірні дані під час авторизації.</li>
            <li>Доступ до акаунта є персональним; передача логіна/пароля третім особам заборонена.</li>
            <li>Користувач несе відповідальність за дії, здійснені під його обліковим записом.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">3. Права та обовʼязки сторін</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Користувач має право використовувати Сервіс за призначенням, отримувати підтримку та
              повідомляти про помилки.
            </li>
            <li>
              Користувач зобовʼязаний не вчиняти дій, що порушують роботу Сервісу або права інших
              осіб.
            </li>
            <li>
              Володілець Сервісу має право блокувати доступ у разі порушення цих Умов або вимог
              закону.
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">4. Інтелектуальна власність</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Програмний код, дизайн, логотипи, тексти та інші матеріали Сервісу є обʼєктами права
            інтелектуальної власності та охороняються відповідно до законодавства України.
            Копіювання, модифікація та розповсюдження без письмового дозволу правовласника
            заборонені, крім випадків, прямо передбачених законом.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">5. Відповідальність і обмеження</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Сервіс надається за принципом «як є» в межах технічної доступності.</li>
            <li>
              Володілець не відповідає за збої, спричинені діями третіх осіб, провайдерів або
              обставинами непереборної сили.
            </li>
            <li>
              Користувач самостійно відповідає за законність і зміст даних, які вносить до Сервісу.
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">6. Вирішення спорів і застосовне право</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            До цих Умов застосовується право України. Сторони прагнуть вирішувати спори шляхом
            переговорів. Якщо згоди не досягнуто, спір підлягає розгляду в судах України за
            правилами підсудності, визначеними процесуальним законодавством.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">7. Звернення та контакти</h2>
          <p className="mt-3 text-sm text-slate-700">
            З питань застосування цих Умов, а також повідомлень про можливі порушення, звертайтесь
            на email{" "}
            <a className="text-amber-600 underline underline-offset-2" href="mailto:legal@enver.ua">
              legal@enver.ua
            </a>
            .
          </p>
        </section>

        <div className="mt-8 text-sm text-slate-500">
          Питання щодо обробки персональних даних дивіться у{" "}
          <Link href="/privacy" className="text-amber-600 underline underline-offset-2">
            Політиці конфіденційності
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
