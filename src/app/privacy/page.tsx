import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Політика конфіденційності | ENVER CRM",
  description:
    "Політика обробки персональних даних у ENVER CRM відповідно до законодавства України.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--enver-bg)] px-4 py-8 text-[var(--enver-text)] md:px-8">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200/80 bg-[var(--enver-card)] p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold md:text-3xl">Політика конфіденційності</h1>
        <p className="mt-2 text-sm text-slate-500">Останнє оновлення: 29.04.2026</p>

        <section className="mt-6 space-y-3 text-sm leading-6 text-slate-700">
          <p>
            Ця Політика визначає порядок обробки персональних даних у Сервісі ENVER CRM відповідно
            до Закону України «Про захист персональних даних», Закону України «Про інформацію»,
            Закону України «Про електронні комунікації» та інших нормативно-правових актів України.
          </p>
          <p>
            Використовуючи Сервіс, ви підтверджуєте, що ознайомились із цією Політикою та
            погоджуєтесь з обробкою персональних даних у межах, визначених цією Політикою і
            законодавством.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">1. Склад та джерела персональних даних</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Ідентифікаційні дані (ПІБ, робоча роль, назва компанії).</li>
            <li>Контактні дані (email, номер телефону за наявності).</li>
            <li>Технічні дані (IP-адреса, браузер, час сесії, службові логи безпеки).</li>
            <li>Дані, які ви самостійно додаєте у CRM-картки та документи.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">2. Мета та правові підстави обробки</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Надання доступу до облікового запису та функцій Сервісу.</li>
            <li>Виконання договірних відносин із клієнтами та партнерами.</li>
            <li>Забезпечення інформаційної безпеки та запобігання зловживанням.</li>
            <li>Виконання вимог законодавства України та запитів уповноважених органів.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">3. Права субʼєкта персональних даних</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Відповідно до статті 8 Закону України «Про захист персональних даних» ви маєте право:
            знати про джерела збору та місцезнаходження даних, отримувати доступ до своїх даних,
            вимагати виправлення або видалення, відкликати згоду (коли обробка базується на згоді),
            а також звертатись зі скаргами до Уповноваженого Верховної Ради України з прав людини
            або до суду.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">4. Передача даних третім особам</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Дані можуть передаватись обробникам (провайдерам хостингу, сервісам підтримки) виключно
            в обсязі, необхідному для роботи Сервісу, та за умови дотримання конфіденційності.
            Передача даних державним органам здійснюється лише у випадках і порядку, передбачених
            законодавством України.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">5. Строки зберігання та захист даних</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Дані зберігаються не довше, ніж це необхідно для мети обробки.</li>
            <li>
              Для захисту застосовуються організаційні та технічні заходи контролю доступу, логування
              та резервного копіювання.
            </li>
            <li>
              Після досягнення мети обробки або за законною вимогою дані видаляються або
              знеособлюються.
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">6. Cookie та аналітика</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Сервіс використовує технічно необхідні cookie для авторизації, підтримки сесії та
            безпеки. Додаткові cookie (аналітика/маркетинг) застосовуються лише за наявності
            правової підстави та, за необхідності, після отримання відповідної згоди.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">7. Запити субʼєктів персональних даних</h2>
          <p className="mt-3 text-sm text-slate-700">
            Для реалізації прав щодо персональних даних (доступ, виправлення, видалення, обмеження
            обробки) надсилайте запит на email{" "}
            <a
              className="text-amber-600 underline underline-offset-2"
              href="mailto:privacy@enver.ua"
            >
              privacy@enver.ua
            </a>
            .
          </p>
        </section>

        <div className="mt-8 text-sm text-slate-500">
          Загальні правила користування Сервісом викладено в{" "}
          <Link href="/terms" className="text-amber-600 underline underline-offset-2">
            Умовах використання
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
