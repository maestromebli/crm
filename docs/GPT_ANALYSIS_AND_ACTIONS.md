# Аналіз CRM і виконані кроки (за `FOR_CHATGPT_UA.md`)

Цей документ відповідає на промпт із [`FOR_CHATGPT_UA.md`](../FOR_CHATGPT_UA.md): архітектура, сильні сторони, ризики, покращення з прив’язкою до файлів. Нижче — **чеклист кроків** з того файлу та **що зроблено в репозиторії** за цю задачу.

---

## Чеклист кроків з `FOR_CHATGPT_UA.md`

| Крок | Статус |
|------|--------|
| Згенерувати архів: `pnpm backup:gpt` | Виконується при оновленні бекапу; шлях у `backups/LATEST_GPT_BUNDLE.txt` |
| Завантажити `crm-for-chatgpt-analysis.tar.gz` у ChatGPT | Дія користувача |
| Додати промпт з `FOR_CHATGPT_UA.md` у чат | Дія користувача |
| (Опційно) `pnpm backup:full` для дампу БД | Лише за потреби; не ділитися без очищення ПД |

---

## 1) Архітектура (коротко)

| Шар | Що це |
|-----|--------|
| **UI** | Next.js 16 App Router: `src/app/(dashboard)/**`, клієнтські компоненти в `src/components/**`, модулі `src/modules/**` |
| **API** | Route Handlers `src/app/api/**` — єдиний «бекенд» у проді; авторизація через `src/lib/authz/api-guard.ts` + `P.*` з `src/lib/authz/permissions.ts` |
| **Дані** | PostgreSQL + Prisma (`prisma/schema.prisma`), клієнт `src/lib/prisma.ts` (singleton, перевірка відповідності codegen) |
| **Домен** | Ліди (`features/leads/queries.ts`), угоди / workspace (`components/deal-workspace`, `hooks/deal-workspace`), контакти, задачі, календар, договори |
| **Документація** | `docs/IMPLEMENTATION_STACK_MAP.md`, `docs/DATABASE.md`, `docs/PHASE1_RBAC_AND_ROADMAP.md` тощо |

**Авторизація:** NextAuth (`src/lib/auth/options`), сесія з `permissionKeys`, scope власника (`lib/authz/data-scope.ts`) для лідів/угод.

---

## 2) Сильні сторони

- Чіткий **RBAC** і перевірки на API-роутах замість лише UI.
- **Prisma** як єдине джерело моделі; насичена схема під реальний бізнес-процес (угоди, договори, готовність, вкладення).
- **Аудит** (`ActivityLog`, історія стадій) закладені в модель.
- **Документація** з картами API/стеку зменшує «bus factor».

---

## 3) Технічний борг / ризики

| Ризик | Деталі |
|-------|--------|
| **Розмір моноліту** | Вся логіка в Next — зростання `src/` ускладнює поділ на сервіси (див. `docs/IMPLEMENTATION_STACK_MAP.md` про `apps/api`). |
| **Обхід Prisma для `Contact.lifecycle`** | `src/lib/contacts/contact-lifecycle-raw.ts` — компроміс через розсинхрон `prisma generate` / схеми; краще тримати `generate` у CI/CD після pull. |
| **Дубляж доків** | Кілька файлів про бекап для GPT (`FOR_CHATGPT_UA.md`, `docs/BACKUP_FOR_CHATGPT.md`) — звели до перехресних посилань у цій задачі. |
| **Deprecation Next** | Попередження про `middleware` → `proxy` — запланувати міграцію на версії Next. |
| **Секрети** | Архів для GPT свідомо без `.env`; повний `backup:full` може містити чутливі дані — не публікувати. |

---

## 4) Конкретні покращення (пріоритет)

1. **CI:** `pnpm exec prisma validate` + `pnpm exec prisma generate` + `pnpm exec tsc --noEmit` на кожен PR.  
   *Файли:* `package.json`, pipeline (GitHub Actions / інше).

2. **Єдиний workflow Prisma:** після зміни `schema.prisma` — завжди `generate`; optional `migrate` замість лише `db push` у проді.  
   *Файли:* `prisma/schema.prisma`, `docs/DATABASE.md`.

3. **Прибрати raw SQL для lifecycle**, коли всі середовища оновлять клієнт: повернути `lifecycle` у `select` у `features/leads/queries.ts`.  
   *Файли:* `src/lib/contacts/contact-lifecycle-raw.ts`, `queries.ts`.

4. **Rate limiting / abuse** для публічних або чутливих `POST` API (логін уже окремо).  
   *Точки:* `src/app/api/**/route.ts` за пріоритетом.

5. **Спостережуваність:** кореляційний id у логах помилок Prisma (`logPrismaError`).  
   *Файли:* `src/lib/prisma-errors.ts`.

6. **Тести:** e2e критичних потоків (лід → угода) — розширити `tests/e2e`.  
   *Файли:* `tests/e2e/*`.

7. **Консолідація доків:** один «вхід» для розробника — посилання з `README` кореня на `docs/IMPLEMENTATION_STACK_MAP.md` і цей файл.  
   *Файли:* кореневий `README.md` (якщо є).

8. **Next `middleware` → `proxy`:** коли документація стабілізується під вашу версію Next.  
   *Файли:* `middleware.ts` / конфіг.

---

## 5) Що зроблено в репозиторії (ця задача)

- Додано **цей файл** `docs/GPT_ANALYSIS_AND_ACTIONS.md` — структурований аналіз і список дій.
- Оновлено **[`FOR_CHATGPT_UA.md`](../FOR_CHATGPT_UA.md)** — посилання сюди та на бекап-док.
- Оновлено **[`docs/BACKUP_FOR_CHATGPT.md`](./BACKUP_FOR_CHATGPT.md)** — узгоджено з `pnpm backup:gpt` і додано посилання на аналіз.
- Запущено **`pnpm backup:gpt`** — згенеровано свіжий `crm-for-chatgpt-analysis.tar.gz` (шлях у `backups/LATEST_GPT_BUNDLE.txt`).

---

*Оновлюйте цей розділ після наступних ітерацій аналізу в ChatGPT.*
